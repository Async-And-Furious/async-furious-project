# ADR-0019: DynamoDB como banco de leitura de Ordem de Serviço e Cliente

## Status

Aceita

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
- Sincronização por **write-through síncrono**: o mesmo caso de uso que
  grava no Postgres atualiza o item correspondente no DynamoDB logo após o
  commit, dentro do mesmo request.
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
  dois itens numa única consulta; `cliente-read-model` já embute o resumo
  das OS do cliente).
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

- Escrita dupla por request de comando: todo caso de uso que muda o estado
  de `OrdemServico` ou `Cliente` (incluindo os disparados por consumo de
  evento Kafka — `OrcamentoGerado`, `OrcamentoAprovado`,
  `OrcamentoRejeitado`, `ExecucaoIniciada`, `PagamentoRecusado`,
  `OrcamentoGeracaoFalhou`, `ExecucaoInicioFalhou`, ver
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
