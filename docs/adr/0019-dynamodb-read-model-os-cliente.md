# ADR-0019: DynamoDB como banco de leitura de Ordem de Serviço e Cliente

## Status

Aceita — escopo revisado em 30/09/2026 (ver [Revisão de 30/09/2026](#revisão-de-30092026)).
Onde o texto abaixo divergir da revisão, **vale a revisão**.

## Contexto

A Fase 4 exige "pelo menos um banco relacional e pelo menos um banco não
relacional" (enunciado, p.3), com banco próprio por serviço e sem acesso
direto ao banco de outro serviço (p.4). O grupo fechou, em 21/09/2026
(`fase4-decisoes-epico1.md`, F4), que o NoSQL fica no **OS Service**, como
banco de leitura de `OrdemServico` e `Cliente`, em um desenho **CQRS** — não
como peça decorativa, o que alimenta diretamente o item "Justificativa da
divisão dos microsserviços e tecnologias utilizadas" do PDF de entrega
(p.6).

O motor escolhido no mesmo dia foi o **DynamoDB**, revisão da escolha
inicial de MongoDB feita horas antes. A fila de execução por prioridade
(`GET /ordens-servico`) hoje ordena em memória, no próprio código da
aplicação, usando `STATUS_PRIORIDADE`
(`src/modules/ordem-servico/domain/policies/status-priority.policy.ts`):

```ts
export const STATUS_PRIORIDADE: Record<OSStatus, number> = {
  IN_PROGRESS: 1,
  AWAITING_APPROVAL: 2,
  UNDER_DIAGNOSIS: 3,
  RECEIVED: 4,
  AWAITING_PARTS: 5,
  CLOSED_WITHOUT_EXECUTION: 6,
  FINISHED: 7,
  DELIVERED: 8,
};
```

Esse `sort()` em memória (`ordem-servico.repository.ts`) funciona hoje
porque o Postgres é consultado inteiro e ordenado depois na aplicação. Um
banco de leitura dedicado permite que essa ordenação seja resolvida pelo
próprio armazenamento, e é o motivo concreto — não decorativo — de o
DynamoDB existir nesta arquitetura.

## Decisão

Manter o **PostgreSQL como fonte da verdade** (lado de escrita, sem
alteração) e introduzir o **DynamoDB como lado de leitura** de
`OrdemServico` e `Cliente`, exclusivo do OS Service:

- Duas tabelas — `os-read-model` (item por OS) e `cliente-read-model` (item
  por cliente) — em vez de single-table design: mais simples de operar em 8
  semanas, ao custo de não ter uma query só que atravesse os dois.
- Um GSI obrigatório em `os-read-model`, com chave de ordenação composta
  `prioridade#createdAt`, para servir `GET /ordens-servico` sem `ORDER BY`
  em memória.
- Sincronização por **write-through síncrono**: quem grava no Postgres (o
  repository, ver "Write-through no repository" na revisão abaixo) atualiza o
  item correspondente no DynamoDB logo após o commit, dentro do mesmo request.
- DynamoDB em modo `PAY_PER_REQUEST`, provisionado por Terraform no
  `repo-db-infra` (Epic #312, Feature #315 — fora do escopo desta ADR).
- Acesso via AWS SDK v3 (`@aws-sdk/lib-dynamodb`) — não há suporte Prisma
  para DynamoDB; o custo de manter dois mecanismos de acesso a dado
  (Prisma + SDK) é aceito.

O modelo de dados completo (chaves, atributos, formato do GSI, rotas
migradas, mecanismo de write-through e procedimento de reconstrução) está
em [`docs/architecture/persistence-model.md`](../architecture/persistence-model.md)
— não duplicado aqui para não haver duas fontes de verdade divergentes.

## Alternativas consideradas

- **MongoDB** (escolha inicial do mesmo dia, revisada horas depois):
  descartada — nenhum ganho de modelagem sobre DynamoDB para um read model
  de duas tabelas simples, e DynamoDB evita mais um componente para
  operar/atualizar no cluster (sem StatefulSet, sem operador, sem
  dimensionamento de nó).
- **DocumentDB** (API compatível com MongoDB, gerenciado pela AWS):
  descartado por custo — não cabe em conta acadêmica de free tier (ver nota
  em `docs/adr/0004-banco-dados-gerenciado.md`).
- **Single-table design**: avaliado e descartado — ganharia uma query que
  atravessasse OS e Cliente em uma única chamada, mas custaria mais
  complexidade de modelagem de chave composta para um ganho que nenhuma
  rota hoje precisa (nenhuma rota lista "OS de um cliente" combinando os
  dois itens numa única consulta).
- **Projeção assíncrona por evento** (o caso de uso publica um evento de
  domínio e um consumidor separado atualiza o DynamoDB): descartada —
  traria consistência eventual visível ao cliente (ex.: `GET
  /ordens-servico/:id/status` logo após `POST /ordens-servico` podia não
  encontrar o item) sem necessidade real, já que o próprio processo já está
  em memória com o dado pronto para escrever.
- **CDC/Debezium** (captura de mudança direto do WAL do Postgres):
  descartada — mais um componente pesado (conector Kafka Connect, mais um
  serviço a monitorar) num cluster já no limite de capacidade para a Fase
  4, sem ganho sobre o write-through síncrono para o volume de escrita
  esperado em ambiente acadêmico.

## Consequências positivas

- O DynamoDB ganha papel de negócio real: resolve a ordenação da fila por
  prioridade no próprio armazenamento, em vez de o código da aplicação
  buscar tudo do Postgres e ordenar em memória.
- Read model **descartável e reconstruível** a partir do Postgres (ver
  `persistence-model.md`) — nenhuma escrita de negócio depende do
  DynamoDB estar no ar; só a leitura.
- `PAY_PER_REQUEST` elimina a necessidade de dimensionar capacidade
  provisionada para um volume de dados e tráfego que ainda não existe
  (contexto acadêmico).

## Consequências negativas

- Escrita dupla por request de comando: toda escrita de `OrdemServico` ou
  `Cliente` no repository (incluindo as disparadas por consumo de
  evento Kafka — `DiagnosticoIniciado`, `OrcamentoGerado`,
  `OrcamentoAprovado`, `OrcamentoRecusado`, `PagamentoConfirmado`,
  `PagamentoRecusado`, `ExecucaoIniciada`, `ExecucaoConcluida`,
  `EtapaDaSagaFalhou`, ver
  [`event-catalog.md`](../architecture/event-catalog.md)) ganha uma segunda
  escrita, ao SDK do DynamoDB, depois do commit no Postgres.
- Sem transação entre os dois bancos: o commit no Postgres e a atualização
  no DynamoDB não são atômicos. O comportamento em caso de falha da segunda
  escrita está documentado em `persistence-model.md` — aceito como trade-off
  de não introduzir 2PC/saga interna só para dois bancos do mesmo serviço.
- Duas fontes de verdade para o mesmo dado (Postgres escreve,
  DynamoDB serve leitura) exigem disciplina de manter os dois em sincronia
  toda vez que um novo campo for adicionado ao agregado de OS ou Cliente —
  não há geração automática de schema como o Prisma faz para o lado
  relacional.
- Nenhuma leitura ad-hoc (filtro arbitrário, relatório): o DynamoDB só serve
  os acessos por chave/GSI já modelados. Qualquer necessidade de consulta
  nova (ex.: relatório administrativo por período livre) exige nova
  Feature de modelagem, não uma query improvisada como seria possível hoje
  com SQL.

## Riscos

- **Médio**: write-through síncrono adiciona uma chamada de rede (SDK v3 →
  DynamoDB) ao caminho de escrita de cada caso de uso afetado — aumenta a
  latência de cada request que já grava no Postgres. Aceito por ora; se
  virar gargalo perceptível, é decisão de revisão futura (fora do escopo
  desta ADR).
- **Baixo**: a contagem de rotas que passam a ser servidas pelo read model
  (`persistence-model.md`) foi validada contra os controllers reais do
  código (`ordem-servico.controller.ts`, `cliente.controller.ts`) no
  momento da escrita desta ADR — uma rota nova adicionada depois, fora
  desta auditoria, pode não ter sido migrada junto.

## Revisão de 30/09/2026

Revisão do épico #306 (`rev/Epic_1`). A decisão central (Postgres como
fonte da verdade, DynamoDB como lado de leitura exclusivo do OS Service,
CQRS com write-through síncrono) **continua valendo**. O que mudou foi o
**escopo** do read model e o **ponto de integração** do write-through. O
texto original acima fica como registro histórico; o desenho vigente é o de
[`persistence-model.md`](../architecture/persistence-model.md), alinhado a
esta seção.

**Motivo da revisão: minimalismo.** O motivo real do NoSQL nesta
arquitetura é (1) a **fila de OS ordenada por prioridade**, resolvida pelo
GSI no próprio armazenamento, e (2) a **exigência do enunciado** de ter um
banco não relacional. Nada além disso justifica custo de modelagem e de
sincronização; o escopo inicial (itens com peças/serviços, histórico
embutido, resumo de OS dentro do cliente, busca de cliente por `Scan`) foi
cortado para o que sustenta esses dois motivos.

Escopo vigente — **"OS + Cliente simples"**:

- `os-read-model`: apenas campos escalares da OS (a resposta atual de
  `GET /ordens-servico/:id` devolve só `clienteId`/`veiculoId`; nome do
  cliente e dados do veículo são embutidos pelo read model como acréscimo),
  `status`, `marcos` (`createdAt`, `iniciadaEm`, `finalizadaEm`,
  `entregueEm`) e os atributos do GSI da fila. **Sem** `itens` e **sem** `historico` embutidos
  (a resposta atual da OS não os devolve; o histórico continua só no
  Postgres). Serve `GET /ordens-servico`, `GET /ordens-servico/:id` e
  `GET /ordens-servico/:id/status`. A rota `/rastreamento` foi **removida**
  na Fase 4.
- `cliente-read-model`: item **plano**, no formato do `ClienteResponseDto`
  atual (`id`, `nome`, `email`, `telefone`, `documento`, `tipoDocumento`).
  **Sem** `veiculos` (a resposta atual não os inclui) e **sem**
  `resumoOrdensServico`. Serve apenas `GET /clientes/:id`.
- **Permanecem no Postgres**: `GET /ordens-servico/tempo-medio` (agregação),
  `GET /veiculos/:id` e **`GET /clientes`** (listagem e `?search=`): a
  listagem exige `Scan` (busca parcial em `nome`/`email`/`documento` e
  `pagination.total`) e o `Scan` foi rejeitado por não escalar. A decisão
  anterior (Scan + `FilterExpression`) fica **revogada**.
- **`orcamento` sai da resposta da OS.** `Orcamento` pertence ao Billing
  Service (ADR-0017). **Quebra de contrato aceita** em `GET
  /ordens-servico` e `GET /ordens-servico/:id`. O read model e o rebuild
  **não** dependem de `Orcamento`.
- **`CLOSED_WITHOUT_EXECUTION` entra em `STATUS_EXCLUIDOS_DA_LISTAGEM`**
  (`status-priority.policy.ts`): a OS encerrada sem execução sai da fila e
  do GSI (índice esparso), como `FINISHED`/`DELIVERED`. **Mudança de
  comportamento** da listagem — hoje essa OS aparece na fila, com prioridade
  6. Implementação do código pendente (esta revisão é só de documentação).

**Write-through no repository, não no caso de uso.** O texto original
coloca a segunda escrita "no mesmo caso de uso". Isso exigiria alterar 8
handlers `atualizar-status-*` e o `AtualizarOrdemServicoUseCase`, que gravam
`status` direto, sem histórico. Decisão vigente:

- Um port de domínio `IOsReadModelProjector` é injetado no repository
  Prisma de OS (e no de Cliente, para o `cliente-read-model`).
  Implementação com AWS SDK v3 na infraestrutura.
- A projeção é **refresh por id**: relê o agregado do Postgres e faz
  `PutItem`. O **mesmo builder** de item serve ao job de rebuild
  (`persistence-model.md` §6).
- `OrdemServicoRepository.update` passa a gravar `HistoricoStatusOS`
  **sempre que `data.status` muda**, no mesmo `$transaction`, com `motivo`
  opcional em `OrdemServicoUpdateData`. Hoje só
  `UpdateServiceOrderStatusUseCase` grava histórico; a mudança garante o
  histórico em todos os caminhos (HTTP e consumidores Kafka). O refresh do
  read model acontece **depois** do histórico. O `new PrismaClient()` extra
  de `status-history.repository.ts` é removido (passa a usar o
  `PrismaService` injetado).
- Hoje não existe `prisma.$transaction` no código; "após o commit" passa a
  significar **após a transação do repository**.
- Falha no DynamoDB é **capturada, logada e emite métrica/evento custom**
  (#335); não derruba a requisição (comportamento já descrito no
  `persistence-model.md` §5).

**Limite aceito:** o `os-read-model` embute nome do cliente e dados do
veículo como foto no momento do refresh da OS; editar o cliente/veículo não
reprojeta as OS existentes até a próxima escrita na OS ou um rebuild.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.3, p.4 e p.6
- `fase4-decisoes-epico1.md`, seção F4 e sub-decisão 4.5 (fora do repositório, workspace local do grupo)
- Issue [#310](https://github.com/Async-And-Furious/async-furious-project/issues/310) — Definir Persistência por Serviço
- Epic [#306](https://github.com/Async-And-Furious/async-furious-project/issues/306) — Arquitetura Alvo da Fase 4
- [`docs/architecture/persistence-model.md`](../architecture/persistence-model.md) (modelo de dados completo)
- [ADR-0017 — Divisão em três microsserviços e ownership de dados](./0017-divisao-microsservicos-ownership-dados.md)
- [ADR-0020 — Bancos compartilhados com isolamento por credencial](./0020-bancos-compartilhados-isolamento-credencial.md)
- [`docs/architecture/event-catalog.md`](../architecture/event-catalog.md), [`docs/architecture/saga-flow.md`](../architecture/saga-flow.md)
- `src/modules/ordem-servico/domain/policies/status-priority.policy.ts`
- `prisma/schema.prisma`
- Documentação oficial do Amazon DynamoDB (Global Secondary Index, esparsidade de índice) e do AWS SDK v3 (`@aws-sdk/lib-dynamodb`)
