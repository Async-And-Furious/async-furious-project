# Modelo de Persistência por Serviço (Fase 4)

> Este documento fecha a Feature #310 ("Definir Persistência por Serviço"),
> filha do Epic #306 ("Arquitetura Alvo da Fase 4"), e detalha as decisões
> registradas em [ADR-0019](../adr/0019-documentdb-read-model-os-cliente.md)
> (DocumentDB como banco de leitura) e
> [ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md)
> (bancos compartilhados com isolamento por credencial). Segue a mesma
> convenção de marcação de `service-boundaries.md`: `[DECIDIDO]` para o que
> já foi fechado pelo grupo, `[PENDENTE]` para o que depende de Feature
> futura.
>
> **Revisão de 30/09/2026 (`rev/Epic_1`).** Escopo do read model reduzido
> a "OS + Cliente simples" (minimalismo; o motivo real do NoSQL é a fila
> ordenada por prioridade e a exigência do enunciado): `os_read_model` sem
> `itens`/`historico`, `cliente_read_model` plano sem `veiculos` nem
> `resumoOrdensServico`; `GET /clientes` (lista e `?search=`),
> `GET /veiculos/:id` e `tempo-medio` ficam no Postgres; `/rastreamento`
> removido; `orcamento` sai da resposta da OS (quebra de contrato aceita);
> `CLOSED_WITHOUT_EXECUTION` sai da fila. Write-through e histórico de
> status passam a viver **no repository** (port `IOsReadModelProjector`).
> Nomes de banco fechados e bootstrap definidos (§8). **Revisão de
> 02/10/2026:** o motor do read model passou de DynamoDB para DocumentDB
> (ADR-0019); tabela vira coleção, item vira documento e o índice secundário global vira índice
> parcial. **Implementação de 29/10/2026 (#335):** o índice ficou composto
> e **não parcial** em (`prioridade`, `createdAt`, `_id`), com o filtro
> `status $nin` na query e paginação por cursor keyset (§3); cliente e veículo
> viraram subdocumentos. Detalhe em
> [ADR-0019](../adr/0019-documentdb-read-model-os-cliente.md) e
> [ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md).

## 1. Escopo

- **Lado de escrita (PostgreSQL)**: continua sendo a fonte da verdade e o
  único lugar que recebe comando — nada muda no modelo de escrita além do
  que a Feature #307 já decidiu (`service-boundaries.md`, ADR-0017).
- **Lado de leitura (DocumentDB)**: exclusivo do OS Service, cobre
  `OrdemServico` (fila por prioridade, detalhe e status consultado
  publicamente pelo cliente) e `Cliente` (apenas `GET /clientes/:id`). As demais
  leituras (§4) continuam no Postgres.
- **Fora do escopo deste documento**: provisionamento do DocumentDB e dos
  bancos Postgres isolados por Terraform (Feature #315, Epic #312);
  implementação da projeção e das rotas de leitura no código do OS Service
  (Epic #329); modelagem do agregado de Execução e Produção (Feature #320).

## 2. Modelo de dados DocumentDB

Banco lógico `os_read_model`. A chave primária de cada documento é o `_id`; os tipos abaixo são os BSON equivalentes (`S` = string,
`M` = subdocumento). Coleções e índices são criados de forma idempotente
pelo OS Service na subida.

### 2.1. `os_read_model` — documento por Ordem de Serviço

| Atributo | Tipo | Papel | Observação |
|---|---|---|---|
| `_id` | `S` | Chave primária | Mesmo `id` (UUID) da OS no Postgres — chave natural, sem gerar id novo |
| `cliente` | `M` | Subdocumento | `{ id, nome, documento }` — foto do cliente no momento da projeção, evita join de leitura |
| `veiculo` | `M` | Subdocumento | `{ id, placa, marca, modelo }` — idem |
| `status` | `S` | Atributo (`SOStatus`) | Espelha `OrdemServico.status` |
| `descricao` | `S` (opcional) | Atributo | — |
| `prioridade` | `N` | Primeiro campo do índice da fila | `STATUS_PRIORIDADE` do status atual (`status-priority.policy.ts`) |
| `createdAt`, `updatedAt` | `Date` | Segundo campo do índice da fila / auditoria | `created_at` e `updated_at` do Postgres |
| `marcos` | `M` | Subdocumento | `{ createdAt, iniciadaEm, finalizadaEm, entregueEm }` — espelha os quatro timestamps do Prisma |

**Fora do documento (decisão de 30/09/2026):** `itens` (peças/serviços) e
`historico` não são embutidos — a resposta atual da OS não os devolve, e o
histórico continua só em `HistoricoStatusOS` no Postgres. **`orcamento`
também não entra** e **sai da resposta da OS** (pertence ao Billing Service,
ADR-0017): **quebra de contrato aceita** em `GET /ordens-servico` e
`GET /ordens-servico/:id`. O documento tem tamanho pequeno e fixo, muito abaixo
do limite de 400 KB.

**Limite aceito:** `cliente`/`veiculo` são foto do refresh da OS;
editar cliente ou veículo não reprojeta as OS existentes até a próxima
escrita na OS ou um rebuild (§6).

### 2.2. `cliente_read_model` — documento por Cliente

| Atributo | Tipo | Papel | Observação |
|---|---|---|---|
| `_id` | `S` | Chave primária | Mesmo `id` (UUID) do Cliente no Postgres |
| `nome`, `email`, `telefone`, `documento`, `tipoDocumento` | `S` | Atributos | Mesmo formato do `ClienteResponseDto` atual (`id` é `clienteId`) |

Documento **plano**: **sem** `veiculos` (a resposta atual não os inclui) e
**sem** `resumoOrdensServico`. `cliente_read_model` **não tem índice secundário** e serve
apenas `GET /clientes/:id`, por chave primária.

## 3. Índice da fila por prioridade

**Nome:** `fila_prioridade_createdAt_id`, na coleção `os_read_model`: índice
composto ascendente em (`prioridade`, `createdAt`, `_id`), **não parcial**,
criado com `createIndex` na subida do OS Service
(`read-model-bootstrap.service.ts`).

- **Saída da fila por filtro na query:** `find({ status: { $nin:
  STATUS_EXCLUIDOS_DA_LISTAGEM } })`, com `FINISHED`, `DELIVERED` e
  `CLOSED_WITHOUT_EXECUTION`. **Mudança de comportamento aplicada:**
  `CLOSED_WITHOUT_EXECUTION` (antes na fila com prioridade 6) só aparece em
  `GET /ordens-servico/:id`. O índice parcial do desenho anterior
  (`filaGrupo`/`filaOrdem`) foi descartado para usar só operadores
  suportados por DocumentDB e MongoDB e não depender de `partialFilterExpression`.
- **Ordenação:** `sort({ prioridade: 1, createdAt: 1, _id: 1 })`: maior
  prioridade primeiro, mais antiga primeiro dentro da mesma prioridade, e
  `_id` como desempate estável. É a mesma ordem do `findMany` + `sort()` em
  memória que existia antes.
- **Paginação por cursor keyset** (não por `skip`): a API recebe `limit`
  (1 a 100, padrão 10) e `cursor`, e responde
  `{ data, pagination: { limit, nextCursor } }`. O cursor é opaco (base64url de
  `prioridade`, `createdAt` e `_id` do último documento da página), e a próxima
  página filtra com `$or` sobre essa tupla. **Quebra de contrato aceita:**
  `page`, `total` e `totalPages` saem da resposta de `GET /ordens-servico`.
- **Evidência:** `test/read-model/os-read-model.query.integration.spec.ts`
  roda contra o container `mongo` do CI e confere a ordem da fila paginada e,
  pelo `explain`, que a consulta usa o índice. A mesma conferência contra o
  DocumentDB real fica para HML.

## 4. Rotas de leitura servidas pelo read model

| Rota | Acesso DocumentDB | Observação |
|---|---|---|
| `GET /ordens-servico` | `find` + `sort` no índice `fila_prioridade_createdAt_id` (`os_read_model`), cursor keyset | Substitui o `findMany` + `sort()` em memória |
| `GET /ordens-servico/:id` | `findOne` por `_id` (`ordemServicoId`) (`os_read_model`) | Resposta sem `orcamento` (quebra de contrato aceita) |
| `GET /ordens-servico/:id/status` | `findOne` por `_id` (`ordemServicoId`), projeção apenas de `status`/`marcos` | Consulta pública do cliente. Nenhum serviço a consome: a Fase 4 não tem chamada REST entre serviços (`saga-flow.md`) |
| `GET /clientes/:id` | `findOne` por `_id` (`clienteId`) (`cliente_read_model`) | — |

`GET /ordens-servico/:id/rastreamento` foi **removida** na Fase 4 (era o
mesmo use case de `/status`).

**Rotas que permanecem no Postgres:**

- `GET /ordens-servico/tempo-medio` — agregação administrativa, não é
  leitura de documento de OS.
- `GET /veiculos/:id` — fora do escopo "OS + Cliente simples".
- **`GET /clientes` (listagem e `?search=`)** — a rota aceita busca parcial
  por `nome`/`email`/`documento` (`ListQueryDto.search`,
  `buildSearchWhere` em `cliente.repository.ts`) e devolve
  `pagination.total`. Atender isso no DocumentDB exigiria varredura de coleção com `$regex`
  (sem busca textual livre sem índice dedicado), com custo proporcional ao
  total da coleção. **Decisão de 30/09/2026:** manter no Postgres, em vez de
  aceitar a varredura. A decisão anterior (varredura + filtro) fica
  revogada.
- `POST`, `PATCH` e `DELETE` de ambos os recursos (comandos, sempre via
  Postgres).

## 5. Mecanismo de write-through

- **Onde vive:** no **repository Prisma**, não nos casos de uso. Um port de
  domínio `IOsReadModelProjector` é injetado no repository de OS (e no de
  Cliente, para o `cliente_read_model`); a implementação com AWS
  driver `mongodb` fica na infraestrutura. Como todo caminho de escrita passa pelo
  repository, a projeção cobre automaticamente os endpoints HTTP e os
  consumidores Kafka (`DiagnosticoIniciado`, `OrcamentoGerado`, `OrcamentoAprovado`,
  `OrcamentoRecusado`, `PagamentoConfirmado`, `PagamentoRecusado`, `ExecucaoIniciada`,
  `ExecucaoConcluida`, `EtapaDaSagaFalhou` — ver
  [`event-catalog.md`](./event-catalog.md)) sem tocar nos handlers. O
  gatilho é "o Postgres mudou", não "a requisição é HTTP".
- **Refresh por id:** a projeção relê o agregado do Postgres e faz `replaceOne` com
  `upsert` do documento inteiro. O **mesmo builder** de documento serve ao job de rebuild (§6).
  Mudança em `Cliente` reprojeta o `cliente_read_model` daquele cliente.
- **Histórico de status no repository:** `OrdemServicoRepository.update`
  passa a gravar `HistoricoStatusOS` **sempre que `data.status` muda**, no
  mesmo `$transaction` da atualização da OS; `OrdemServicoUpdateData` ganha o
  campo opcional `motivo`. Hoje só `UpdateServiceOrderStatusUseCase` grava
  histórico, enquanto 8 handlers de `atualizar-status-*` e o
  `AtualizarOrdemServicoUseCase` gravam o status direto sem histórico; a
  mudança garante o histórico em **todos** os caminhos. O
  `UpdateServiceOrderStatusUseCase` **deixa de gravar** o histórico por conta
  própria (senão a linha duplicaria) e só repassa o `motivo`. O
  `new PrismaClient()` extra de `status-history.repository.ts` é removido.
  Exceção deliberada (quando o consumidor Kafka existir): ao consumir
  `PagamentoConfirmado`, o OS Service grava `pago_em` e uma linha de histórico
  (motivo "pagamento confirmado") **sem mudar o status**; `pago_em` não entra no
  `os_read_model`. Em 29/10/2026 os eventos ainda são in-process e não existe
  `pago_em` no schema.
- **Ponto exato:** **depois** da transação do repository (OS + histórico) —
  nunca antes, para nunca projetar um estado que pode ainda ser revertido.
  "Após o commit" significa "após a `$transaction` do repository".
- **Atualização desde `RECEIVED`:** a criação da OS (`POST
  /ordens-servico`) já escreve o primeiro documento em `os_read_model`.
- **Comportamento em caso de falha na escrita do read model:** o Postgres
  já commitou antes da chamada ao DocumentDB (write-through, não 2PC) — não
  há rollback possível nesse ponto. A falha no DocumentDB é **capturada,
  logada em nível de erro e emite o evento custom `ReadModelProjectionFailure`
  no New Relic** (atributos `collection`, `documentId`, `message`; sem alerta
  dedicado), e **não derruba a requisição**: o
  comando de negócio teve sucesso (é o Postgres quem define isso). O documento
  fica desatualizado até a próxima escrita bem-sucedida naquele id ou até um
  rebuild (§6). Trade-off aceito de CQRS com write-through: disponibilidade
  da escrita não fica acoplada à da leitura, ao custo de uma janela de
  inconsistência **rara e sinalizada**.

## 6. Procedimento de reconstrução do read model

O read model é **descartável e reconstruível** a partir do PostgreSQL —
nenhum dado que só existe nele é perdido se as coleções forem apagadas e
recriadas:

1. Recriar o cluster DocumentDB (Terraform, Feature #315); o OS Service recria
   as coleções `os_read_model` e `cliente_read_model` e seus índices na subida.
2. O job `src/jobs/rebuild-read-model.job.ts` (imagem: `node
   dist/jobs/rebuild-read-model.job.js`; local: `pnpm read-model:rebuild`)
   itera o Postgres em páginas de 500 por id: todos os `Cliente` e todas as
   `OrdemServico` (com `Veiculo` e `Cliente` para os campos embutidos;
   **sem `Orcamento`**, que não faz parte do read model). Grava em lote com
   `bulkWrite` de `replaceOne` com `upsert`, reusando o **mesmo builder** do
   write-through (§5), e no fim remove os documentos cujo id não existe mais
   no Postgres. O `deploy-eks.yml` roda o job logo depois do job de
   migration; sob demanda, basta recriar o mesmo Job no namespace. O e2e
   `test/read-model.e2e-spec.ts` demonstra o conserto de um documento
   propositalmente defasado.
3. Não há ordem de execução obrigatória entre as duas coleções — são
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
  `os_read_model` não os embute e a resposta da OS deixa de trazer
  `orcamento`.
- `itens` (peças/serviços) e `historico` da OS, `veiculos` e
  `resumoOrdensServico` do cliente — cortados do escopo inicial
  (30/09/2026); continuam só no Postgres.
- O estado do Execução e Produção — serviço com Postgres próprio, sem
  NoSQL (`service-boundaries.md`, §1.3).
- Nenhuma escrita de negócio vai direto para o DocumentDB — toda escrita
  passa pelo Postgres primeiro; o DocumentDB nunca é a origem de um comando.

## 8. Alocação de banco por serviço

| Serviço | Banco relacional | Banco não relacional |
|---|---|---|
| OS Service | PostgreSQL, banco lógico `os_service` na instância `tc3-db-${environment}` (ADR-0020); `db_name` de `workshop` para `os_service` em `repo-db-infra` (recria a instância) | DocumentDB — banco `os_read_model`, coleções `os_read_model` e `cliente_read_model` (cluster `tc3-docdb-${environment}`) |
| Billing Service | PostgreSQL, banco lógico `billing` na mesma instância — **começa vazio** (`pagamentos` hoje só tem dado de teste) | Nenhum |
| Execução e Produção | PostgreSQL, banco lógico `execucao_producao` na mesma instância — schema nasce vazio | Nenhum |

Detalhe do isolamento por credencial (por que uma instância só, com banco e
usuário separados) está em
[ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md).

**Provisionamento (decidido em 30/09/2026):**

- **Bootstrap:** Job in-cluster, executado no pipeline do OS Service, cria
  os 3 bancos e 3 roles de forma idempotente (`\gexec` + `format()`; `CREATE DATABASE` não roda em `DO $$`). Senhas via
  `random_password` no Terraform → Secrets Manager; artifact do plan com
  `retention-days: 1`. **Dívida:** senha no state.
- **Secrets/outputs (`repo-db-infra`):** `db_connection_secret_arn` aponta
  para o secret do **OS Service** (JSON `host`/`port`/`dbname`/`username`/
  `password`), preservando `deploy-eks.yml` e a CI do `repo-auth-serverless`;
  novo output `db_master_secret_arn`. O Lambda `authenticate-customer` usa o
  secret do OS Service (role somente leitura dedicado = **dívida**).
- **DocumentDB (revisão de 02/10/2026):** cluster criado no `repo-db-infra`;
  acesso por usuário e senha do secret `tc3-docdb-os-<env>` (output
  `docdb_secret_arn`), via TLS; a pipeline materializa `DOCDB_*` no secret do
  namespace. Não há IRSA. **Dívida:** o OS Service usa o master do cluster.
- **Conexões:** `connection_limit=3` na `DATABASE_URL` de cada serviço;
  alarme proporcional ao `max_connections` do `db.t4g.micro` (~80–110,
  estimado); se faltar, subir para `db.t4g.small`.

## 9. Pendências para validação do grupo

1. ~~Confirmar a partição fixa `"ATIVA"` do índice (§3)~~ — **[DECIDIDO]**
   mantida como está. A Fase 4 não exige particionamento por
   oficina/unidade; isso seria a solução "ideal", não a mínima exigida
   pelo enunciado. Sem dado de produção para justificar a complexidade
   extra, o grupo optou por não implementá-la.
2. ~~Varredura + filtro para `GET /clientes?search=` (§4)~~ —
   era **[DECIDIDO]**, **[REVOGADO]** em 30/09/2026: `GET /clientes` fica no
   Postgres (§4).
3. ~~Nomes de banco lógico em §8~~ — **[DECIDIDO]** em 30/09/2026:
   `os_service`, `billing`, `execucao_producao`.

## 10. Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.3, p.4 e p.6
- `fase4-decisoes-epico1.md`, seção F4 e sub-decisão 4.5 (fora do repositório, workspace local do grupo)
- Issue [#310](https://github.com/Async-And-Furious/async-furious-project/issues/310) — Definir Persistência por Serviço
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- [ADR-0019 — DocumentDB como banco de leitura de OS e Cliente](../adr/0019-documentdb-read-model-os-cliente.md)
- [ADR-0020 — Bancos compartilhados com isolamento por credencial](../adr/0020-bancos-compartilhados-isolamento-credencial.md)
- [`service-boundaries.md`](./service-boundaries.md) (mapa de ownership completo, Feature #307)
- [`event-catalog.md`](./event-catalog.md), [`saga-flow.md`](./saga-flow.md) (eventos que disparam write-through)
- `src/modules/ordem-servico/domain/policies/status-priority.policy.ts`
- `src/modules/ordem-servico/infrastructure/repositories/ordem-servico.repository.ts`
- `src/modules/cadastro/presentation/controllers/cliente.controller.ts`
- `prisma/schema.prisma`
- Documentação oficial do Amazon DocumentDB (índices parciais, TLS) e do driver `mongodb`
