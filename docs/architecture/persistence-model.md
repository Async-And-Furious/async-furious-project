# Modelo de Persistência por Serviço (Fase 4)

> Este documento fecha a Feature #310 ("Definir Persistência por Serviço"),
> filha do Epic #306 ("Arquitetura Alvo da Fase 4"), e detalha as decisões
> registradas em [ADR-0019](../adr/0019-dynamodb-read-model-os-cliente.md)
> (DynamoDB como banco de leitura) e
> [ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md)
> (bancos compartilhados com isolamento por credencial). Segue a mesma
> convenção de marcação de `service-boundaries.md`: `[DECIDIDO]` para o que
> já foi fechado pelo grupo, `[PENDENTE]` para o que depende de Feature
> futura.

## 1. Escopo

- **Lado de escrita (PostgreSQL)**: continua sendo a fonte da verdade e o
  único lugar que recebe comando — nada muda no modelo de escrita além do
  que a Feature #307 já decidiu (`service-boundaries.md`, ADR-0017).
- **Lado de leitura (DynamoDB)**: exclusivo do OS Service, cobre apenas
  `OrdemServico` e `Cliente`. Todas as leituras desses dois agregados
  passam a ser servidas por ele — inclusive a fila por prioridade e o
  status consultado pela Saga/Execução.
- **Fora do escopo deste documento**: provisionamento do DynamoDB e dos
  bancos Postgres isolados por Terraform (Feature #315, Epic #312);
  implementação da projeção e das rotas de leitura no código do OS Service
  (Epic #329); modelagem do agregado de Execução e Produção (Feature #320).

## 2. Modelo de dados DynamoDB

### 2.1. `os-read-model` — item por Ordem de Serviço

| Atributo | Tipo | Papel | Observação |
|---|---|---|---|
| `ordemServicoId` | `S` | Chave de partição (PK) | Mesmo `id` (UUID) do Postgres — chave natural, sem tradução |
| `clienteId` | `S` | Atributo | — |
| `clienteNome` | `S` | Atributo embutido | Evita join de leitura para exibir o nome na listagem |
| `clienteDocumento` | `S` | Atributo embutido | Usado no rastreamento público (`/:id/rastreamento`) |
| `veiculoId` | `S` | Atributo | — |
| `veiculoPlaca`, `veiculoMarca`, `veiculoModelo` | `S` | Atributos embutidos | Idem — evita join de leitura |
| `status` | `S` | Atributo (`SOStatus`) | Espelha `OrdemServico.status` |
| `descricao` | `S` (opcional) | Atributo | — |
| `itens` | `L` (lista de `M`) | Atributo embutido | Um mapa por `OsPeca`/`OsServico`: `{ tipo: "PECA"\|"SERVICO", id, nome, quantidade, precoUnitario, valorTotal }` |
| `marcos` | `M` | Atributo embutido | `{ createdAt, iniciadaEm, finalizadaEm, entregueEm }` — espelha os quatro timestamps do Prisma (`created_at`, `iniciada_em`, `finalizada_em`, `entregue_em`) |
| `historico` | `L` (lista de `M`) | Atributo embutido | Um mapa por linha de `HistoricoStatusOS`: `{ statusAnterior, statusNovo, motivo, dataHora }`, ordenado por `dataHora` ascendente |
| `gsi1pk` | `S` (esparso) | Chave de partição do GSI | Ver §3 — **ausente** quando `status` é `FINISHED` ou `DELIVERED` |
| `gsi1sk` | `S` (esparso) | Chave de ordenação do GSI | Ver §3 — ausente nas mesmas condições que `gsi1pk` |

**Tamanho do item:** `itens` e `historico` crescem com o ciclo de vida da
OS, mas dentro de um teto conhecido (uma OS tem dezenas de itens e
transições de status no máximo, nunca milhares) — bem abaixo do limite de
400 KB por item do DynamoDB. Não há paginação interna do item.

### 2.2. `cliente-read-model` — item por Cliente

| Atributo | Tipo | Papel | Observação |
|---|---|---|---|
| `clienteId` | `S` | Chave de partição (PK) | Mesmo `id` (UUID) do Postgres |
| `nome`, `email`, `telefone`, `documento`, `tipoDocumento` | `S` | Atributos | Espelham `Cliente` |
| `veiculos` | `L` (lista de `M`) | Atributo embutido | Um mapa por `Veiculo`: `{ id, placa, marca, modelo, ano }` |
| `resumoOrdensServico` | `L` (lista de `M`) | Atributo embutido | Um mapa por OS do cliente: `{ id, status, createdAt }` — **resumo**, não o item completo de `os-read-model` (evita duplicar `itens`/`historico` e manter o item dentro de um teto de tamanho previsível) |

`cliente-read-model` **não tem GSI** — as únicas leituras que ele serve
(`GET /clientes`, `GET /clientes/:id`) acessam por chave primária ou por
varredura com filtro (ver §4, nota sobre `search`).

## 3. GSI da fila por prioridade

**Nome:** `gsi-fila-prioridade`, na tabela `os-read-model`.

- **Chave de partição (`gsi1pk`):** valor fixo `"ATIVA"` para toda OS cujo
  `status` não seja `FINISHED` nem `DELIVERED` (mesmo conjunto de
  `STATUS_EXCLUIDOS_DA_LISTAGEM` já usado hoje em
  `status-priority.policy.ts`). Uma partição única funciona neste projeto
  porque o volume de OS ativas simultâneas é baixo (escala acadêmica); se o
  volume crescesse a ponto de uma partição única virar gargalo de
  throughput, a revisão (ex.: particionar por oficina/unidade) fica fora do
  escopo desta Feature.
- **Chave de ordenação (`gsi1sk`):** string composta
  `"{prioridade}#{createdAt}"`, onde:
  - `prioridade` é o valor numérico de `STATUS_PRIORIDADE` (já existente em
    `status-priority.policy.ts`: `IN_PROGRESS=1`, `AWAITING_APPROVAL=2`,
    `UNDER_DIAGNOSIS=3`, `RECEIVED=4`, `AWAITING_PARTS=5`), **zero-padded**
    para 3 dígitos (`"001"`, `"002"`, ...) — necessário para que a ordenação
    lexicográfica do DynamoDB coincida com a ordenação numérica.
  - `createdAt` é o timestamp ISO-8601 (`OrdemServico.created_at`), que já
    ordena corretamente como string.
  - Exemplo: uma OS `IN_PROGRESS` criada em `2026-09-21T10:00:00.000Z` gera
    `gsi1sk = "001#2026-09-21T10:00:00.000Z"`.
- **Índice esparso:** quando o write-through transita o `status` para
  `FINISHED` ou `DELIVERED`, o caso de uso **remove** os atributos
  `gsi1pk`/`gsi1sk` do item (não apenas atualiza o valor) — um item sem os
  atributos de chave do GSI não aparece no índice. Isso resolve, no próprio
  armazenamento, a exclusão de `FINISHED`/`DELIVERED` da fila, sem
  necessidade de filtro adicional na query.
- **Query que o GSI atende:** `Query` no GSI com
  `gsi1pk = "ATIVA"`, `ScanIndexForward = true` (ordem ascendente de
  `gsi1sk` = maior prioridade primeiro, mais antiga primeiro dentro da
  mesma prioridade) — exatamente o contrato hoje descrito na
  documentação da rota `GET /ordens-servico`
  (`ordem-servico.controller.ts`): "ordenadas por prioridade de status
  [...] dentro do mesmo status, as mais antigas aparecem primeiro".
  Paginação da API feita com `Limit` + `ExclusiveStartKey` do próprio
  DynamoDB, substituindo o `slice()` em memória atual.

## 4. Rotas de leitura servidas pelo read model

| Rota | Acesso DynamoDB | Observação |
|---|---|---|
| `GET /ordens-servico` | `Query` no GSI `gsi-fila-prioridade` (`os-read-model`) | Substitui o `findMany` + `sort()` em memória atual |
| `GET /ordens-servico/:id` | `GetItem` por `ordemServicoId` (`os-read-model`) | — |
| `GET /ordens-servico/:id/status` | `GetItem` por `ordemServicoId`, projeção apenas de `status`/`marcos` | Consumido pela Saga e pelo Execução e Produção (`saga-flow.md`) |
| `GET /ordens-servico/:id/rastreamento` | Mesmo acesso que `/status` (rota pública, mesmo use case hoje) | — |
| `GET /clientes` | `Scan` com `FilterExpression` quando `search` é informado; sem `search`, `Scan` paginado | Ver nota abaixo |
| `GET /clientes/:id` | `GetItem` por `clienteId` (`cliente-read-model`) | — |

**Nota sobre `GET /clientes?search=`:** a rota hoje aceita busca parcial por
nome (`ListQueryDto.search`, `cliente.repository.ts`). DynamoDB não tem
busca textual livre sem um índice dedicado (ex.: OpenSearch), fora de
escopo para este projeto. A decisão é servir `search` com `Scan` +
`FilterExpression` (`contains(nome, :termo)`) — funciona para o volume de
clientes esperado em ambiente acadêmico, mas não escala (custo de leitura
proporcional ao total de itens da tabela, não ao resultado). Registrado
como trade-off aceito, não como lacuna não percebida; se o volume de
clientes crescer, a revisão natural é um GSI por prefixo de nome ou mover a
busca para outro mecanismo — fora do escopo desta Feature.

**Rotas que NÃO entram** (permanecem no Postgres, fora do read model):
`GET /ordens-servico/tempo-medio` (agregação administrativa, não é leitura
de item de OS — continua consultando o Postgres diretamente), `POST`,
`PATCH` e `DELETE` de ambos os recursos (comandos, sempre via Postgres).

## 5. Mecanismo de write-through

- **Ponto exato:** dentro do mesmo caso de uso que grava no Postgres, **após
  o commit da transação Prisma** — nunca antes, para nunca projetar um
  estado que pode ainda ser revertido por erro de validação/constraint no
  banco relacional.
- **Quem dispara:** qualquer caso de uso do OS Service que altera
  `OrdemServico`, `Cliente`, `Veiculo`, `HistoricoStatusOS`, `OsPeca` ou
  `OsServico` — incluindo os disparados por consumo de evento Kafka
  (`OrcamentoGerado`, `OrcamentoAprovado`, `OrcamentoRejeitado`,
  `ExecucaoIniciada`, `PagamentoRecusado`, `OrcamentoGeracaoFalhou`,
  `ExecucaoInicioFalhou` — ver
  [`event-catalog.md`](./event-catalog.md)), não apenas os endpoints HTTP
  diretos. O gatilho é "o Postgres mudou", não "a requisição é HTTP".
- **Atualização desde `RECEIVED`:** a criação da OS (`POST
  /ordens-servico`) já escreve o primeiro item em `os-read-model` — o read
  model não começa a existir só quando a OS atinge um estado consolidado.
- **Comportamento em caso de falha na escrita do read model:** o Postgres
  já commitou antes da chamada ao DynamoDB (write-through, não 2PC) — não
  há rollback possível nesse ponto. A decisão é: **a request ao cliente
  retorna sucesso** (o comando de negócio, de fato, teve sucesso — é o
  Postgres quem define isso) e a falha de escrita no DynamoDB é registrada
  como erro/alerta (integração com o épico de Observabilidade da Fase 4),
  deixando aquele item do read model temporariamente desatualizado até a
  próxima escrita bem-sucedida naquele mesmo item ou até uma reconstrução
  (§6). Este é o trade-off aceito de CQRS com write-through: disponibilidade
  do lado de escrita não fica acoplada à disponibilidade do lado de
  leitura, ao custo de uma janela de inconsistência **rara e sinalizada**
  em vez de inexistente.

## 6. Procedimento de reconstrução do read model

O read model é **descartável e reconstruível** a partir do PostgreSQL —
nenhum dado que só existe nele é perdido se as tabelas forem apagadas e
recriadas:

1. Recriar `os-read-model` e `cliente-read-model` (Terraform, Feature #315).
2. Rotina de reconstrução (a implementar no Epic #329, fora do escopo desta
   Feature) itera o Postgres em páginas — todos os `Cliente` (com
   `Veiculo`s e resumo de `OrdemServico` via join) e todas as
   `OrdemServico` (com `Orcamento`, `OsPeca`, `OsServico`,
   `HistoricoStatusOS` incluídos) — e executa um `PutItem` idempotente por
   item nas duas tabelas, no mesmo formato descrito em §2.
3. Não há ordem de execução obrigatória entre as duas tabelas — são
   independentes uma da outra.
4. Enquanto a reconstrução roda, o read model pode responder com dado
   parcial/desatualizado; não há uma etapa de "read model indisponível"
   formal — é um trade-off aceito, coerente com o resto desta Feature.

## 7. Fronteiras do read model (o que não entra)

- `Peca`, `Servico`, `PedidoFornecedor`, `PedidoFornecedorItem`,
  `ReservaEstoque` (Bounded Context `pecas-insumos`) — não têm rota de
  leitura de alto volume que justifique um read model; continuam servidos
  direto do Postgres.
- `Orcamento` e `Pagamento` — pertencem ao Billing Service (ADR-0017); o
  `os-read-model` embute apenas o resultado do cálculo dentro de `itens`,
  nunca o documento de orçamento em si.
- O estado do Execução e Produção — serviço com Postgres próprio, sem
  NoSQL (`service-boundaries.md`, §1.3).
- Nenhuma escrita de negócio vai direto para o DynamoDB — toda escrita
  passa pelo Postgres primeiro; o DynamoDB nunca é a origem de um comando.

## 8. Alocação de banco por serviço

| Serviço | Banco relacional | Banco não relacional |
|---|---|---|
| OS Service | PostgreSQL, banco lógico `os_service` na instância `tc3-db-${environment}` (ADR-0020) | DynamoDB — `os-read-model`, `cliente-read-model` |
| Billing Service | PostgreSQL, banco lógico `billing` na mesma instância — **começa vazio** (`pagamentos` hoje só tem dado de teste) | Nenhum |
| Execução e Produção | PostgreSQL, banco lógico `execucao_producao` na mesma instância — schema nasce vazio | Nenhum |

Detalhe do isolamento por credencial (por que uma instância só, com banco e
usuário separados) está em
[ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md).

## 9. Pendências para validação do grupo

1. Confirmar a partição fixa `"ATIVA"` do GSI (§3) como aceitável dado o
   volume esperado de OS ativas simultâneas — nenhum dado de produção
   existe ainda para validar isso empiricamente.
2. Confirmar que `Scan` + `FilterExpression` para `GET /clientes?search=`
   (§4) é aceitável como trade-off de custo de leitura, dado o volume de
   clientes esperado.
3. Validar os nomes de banco lógico propostos em §8 (`os_service`,
   `billing`, `execucao_producao`) antes da Feature #315 provisionar.

## 10. Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.3, p.4 e p.6
- `fase4-decisoes-epico1.md`, seção F4 e sub-decisão 4.5 (fora do repositório, workspace local do grupo)
- Issue [#310](https://github.com/Async-And-Furious/async-furious-project/issues/310) — Definir Persistência por Serviço
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- [ADR-0019 — DynamoDB como banco de leitura de OS e Cliente](../adr/0019-dynamodb-read-model-os-cliente.md)
- [ADR-0020 — Bancos compartilhados com isolamento por credencial](../adr/0020-bancos-compartilhados-isolamento-credencial.md)
- [`service-boundaries.md`](./service-boundaries.md) (mapa de ownership completo, Feature #307)
- [`event-catalog.md`](./event-catalog.md), [`saga-flow.md`](./saga-flow.md) (eventos que disparam write-through)
- `src/modules/ordem-servico/domain/policies/status-priority.policy.ts`
- `src/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository.ts`
- `src/modules/cadastro/presentation/controllers/cliente.controller.ts`
- `prisma/schema.prisma`
- Documentação oficial do Amazon DynamoDB (modelagem de chave, GSI esparso) e do AWS SDK v3 (`@aws-sdk/lib-dynamodb`)
