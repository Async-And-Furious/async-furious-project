# ADR-0019: DocumentDB como banco de leitura de Ordem de Serviço e Cliente

## Status

Aceita — escopo revisado em 30/09/2026 e **motor trocado de DynamoDB para
DocumentDB em 02/10/2026** (ver [Revisão de 02/10/2026](#revisão-de-02102026)).
Onde o texto abaixo divergir das revisões, **valem as revisões**.

## Contexto

A Fase 4 exige "pelo menos um banco relacional e pelo menos um banco não
relacional" (enunciado, p.3), com banco próprio por serviço e sem acesso
direto ao banco de outro serviço (p.4). O grupo fechou, em 21/09/2026
(`fase4-decisoes-epico1.md`, F4), que o NoSQL fica no **OS Service**, como
banco de leitura de `OrdemServico` e `Cliente`, em um desenho **CQRS** — não
como peça decorativa, o que alimenta diretamente o item "Justificativa da
divisão dos microsserviços e tecnologias utilizadas" do PDF de entrega
(p.6).

O motor escolhido em 21/09/2026 foi o **DynamoDB**, revisão da escolha
inicial de MongoDB; em 02/10/2026 o grupo trocou o motor para o
**DocumentDB** (ver revisão ao final). A fila de execução por prioridade
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
o banco de leitura existir nesta arquitetura.

## Decisão

Manter o **PostgreSQL como fonte da verdade** (lado de escrita, sem
alteração) e introduzir o **DocumentDB como lado de leitura** de
`OrdemServico` e `Cliente`, exclusivo do OS Service:

- Duas coleções — `os_read_model` (documento por OS) e `cliente_read_model`
  (documento por cliente) — no banco lógico `os_read_model`: mais simples de
  operar em 8 semanas, ao custo de não ter uma query só que atravesse os dois.
- Um **índice composto parcial** obrigatório em `os_read_model` (`filaGrupo`,
  `filaOrdem`), com campo de ordenação composto `prioridade#createdAt`, para
  servir `GET /ordens-servico` sem `ORDER BY` em memória.
- Sincronização por **write-through síncrono**: quem grava no Postgres (o
  repository, ver "Write-through no repository" na revisão abaixo) atualiza o
  documento correspondente no DocumentDB logo após o commit, dentro do mesmo request.
- Cluster DocumentDB provisionado por Terraform no `repo-db-infra` (Epic
  #312, Feature #315), com uma instância e TLS obrigatório.
- Acesso via driver `mongodb` — não há suporte Prisma para DocumentDB; o
  custo de manter dois mecanismos de acesso a dado (Prisma + driver) é
  aceito.

O modelo de dados completo (chaves, atributos, formato do índice, rotas
migradas, mecanismo de write-through e procedimento de reconstrução) está
em [`docs/architecture/persistence-model.md`](../architecture/persistence-model.md)
— não duplicado aqui para não haver duas fontes de verdade divergentes.

## Alternativas consideradas

- **MongoDB in-cluster** (escolha inicial de 21/09/2026): descartado —
  mais um componente para operar e dimensionar (StatefulSet, operador, nó)
  num cluster já apertado pelo Kafka. O DocumentDB entrega a mesma API como
  serviço gerenciado.
- **DynamoDB** (escolha de 21/09 a 02/10/2026): descartado na troca de
  motor. Atenderia o read model com `PAY_PER_REQUEST` e IRSA, mas o grupo
  preferiu o modelo de documento (consultas e índices MongoDB) e o acesso
  por usuário/senha com o mesmo padrão de secret dos bancos relacionais.
- **Single-table design**: avaliado e descartado — ganharia uma query que
  atravessasse OS e Cliente em uma única chamada, mas custaria mais
  complexidade de modelagem de chave composta para um ganho que nenhuma
  rota hoje precisa (nenhuma rota lista "OS de um cliente" combinando os
  dois itens numa única consulta).
- **Projeção assíncrona por evento** (o caso de uso publica um evento de
  domínio e um consumidor separado atualiza o DocumentDB): descartada —
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

- O DocumentDB ganha papel de negócio real: resolve a ordenação da fila por
  prioridade no próprio armazenamento, em vez de o código da aplicação
  buscar tudo do Postgres e ordenar em memória.
- Read model **descartável e reconstruível** a partir do Postgres (ver
  `persistence-model.md`) — nenhuma escrita de negócio depende do
  DocumentDB estar no ar; só a leitura.
- O modelo de documento e os índices parciais servem a fila por prioridade
  sem filtro adicional na query.

## Consequências negativas

- Escrita dupla por request de comando: toda escrita de `OrdemServico` ou
  `Cliente` no repository (incluindo as disparadas por consumo de
  evento Kafka — `DiagnosticoIniciado`, `OrcamentoGerado`,
  `OrcamentoAprovado`, `OrcamentoRecusado`, `PagamentoConfirmado`,
  `PagamentoRecusado`, `ExecucaoIniciada`, `ExecucaoConcluida`,
  `EtapaDaSagaFalhou`, ver
  [`event-catalog.md`](../architecture/event-catalog.md)) ganha uma segunda
  escrita, ao driver do DocumentDB, depois do commit no Postgres.
- Sem transação entre os dois bancos: o commit no Postgres e a atualização
  no DocumentDB não são atômicos. O comportamento em caso de falha da segunda
  escrita está documentado em `persistence-model.md` — aceito como trade-off
  de não introduzir 2PC/saga interna só para dois bancos do mesmo serviço.
- Duas fontes de verdade para o mesmo dado (Postgres escreve,
  DocumentDB serve leitura) exigem disciplina de manter os dois em sincronia
  toda vez que um novo campo for adicionado ao agregado de OS ou Cliente —
  não há geração automática de schema como o Prisma faz para o lado
  relacional.
- Nenhuma leitura ad-hoc (filtro arbitrário, relatório): o DocumentDB está
  modelado e indexado só para os acessos já definidos. Qualquer necessidade de consulta
  nova (ex.: relatório administrativo por período livre) exige nova
  Feature de modelagem, não uma query improvisada como seria possível hoje
  com SQL.

## Riscos

- **Médio**: write-through síncrono adiciona uma chamada de rede (driver →
  DocumentDB) ao caminho de escrita de cada caso de uso afetado — aumenta a
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
fonte da verdade, DocumentDB (antes DynamoDB) como lado de leitura exclusivo do OS Service,
CQRS com write-through síncrono) **continua valendo**. O que mudou foi o
**escopo** do read model e o **ponto de integração** do write-through. O
texto original acima fica como registro histórico; o desenho vigente é o de
[`persistence-model.md`](../architecture/persistence-model.md), alinhado a
esta seção.

**Motivo da revisão: minimalismo.** O motivo real do NoSQL nesta
arquitetura é (1) a **fila de OS ordenada por prioridade**, resolvida pelo
índice no próprio armazenamento, e (2) a **exigência do enunciado** de ter um
banco não relacional. Nada além disso justifica custo de modelagem e de
sincronização; o escopo inicial (itens com peças/serviços, histórico
embutido, resumo de OS dentro do cliente, busca de cliente por varredura de coleção) foi
cortado para o que sustenta esses dois motivos.

Escopo vigente — **"OS + Cliente simples"**:

- `os-read-model`: apenas campos escalares da OS (a resposta atual de
  `GET /ordens-servico/:id` devolve só `clienteId`/`veiculoId`; nome do
  cliente e dados do veículo são embutidos pelo read model como acréscimo),
  `status`, `marcos` (`createdAt`, `iniciadaEm`, `finalizadaEm`,
  `entregueEm`) e os campos do índice da fila. **Sem** `itens` e **sem** `historico` embutidos
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
  listagem exige varredura de coleção (busca parcial em `nome`/`email`/`documento` e
  `pagination.total`) e a varredura foi rejeitada por não escalar. A decisão
  anterior (varredura + filtro) fica **revogada**.
- **`orcamento` sai da resposta da OS.** `Orcamento` pertence ao Billing
  Service (ADR-0017). **Quebra de contrato aceita** em `GET
  /ordens-servico` e `GET /ordens-servico/:id`. O read model e o rebuild
  **não** dependem de `Orcamento`.
- **`CLOSED_WITHOUT_EXECUTION` entra em `STATUS_EXCLUIDOS_DA_LISTAGEM`**
  (`status-priority.policy.ts`): a OS encerrada sem execução sai da fila e
  do índice (parcial), como `FINISHED`/`DELIVERED`. **Mudança de
  comportamento** da listagem — hoje essa OS aparece na fila, com prioridade
  6. Implementação do código pendente (esta revisão é só de documentação).

**Write-through no repository, não no caso de uso.** O texto original
coloca a segunda escrita "no mesmo caso de uso". Isso exigiria alterar 8
handlers `atualizar-status-*` e o `AtualizarOrdemServicoUseCase`, que gravam
`status` direto, sem histórico. Decisão vigente:

- Um port de domínio `IOsReadModelProjector` é injetado no repository
  Prisma de OS (e no de Cliente, para o `cliente-read-model`).
  Implementação com o driver `mongodb` na infraestrutura.
- A projeção é **refresh por id**: relê o agregado do Postgres e faz
  `replaceOne` com `upsert`. O **mesmo builder** de documento serve ao job de rebuild
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
- Falha no DocumentDB é **capturada, logada e emite métrica/evento custom**
  (#335); não derruba a requisição (comportamento já descrito no
  `persistence-model.md` §5).

**Limite aceito:** o `os-read-model` embute nome do cliente e dados do
veículo como foto no momento do refresh da OS; editar o cliente/veículo não
reprojeta as OS existentes até a próxima escrita na OS ou um rebuild.

## Revisão de 02/10/2026

**Troca de motor: DynamoDB para DocumentDB.** Postgres como fonte da verdade,
CQRS, write-through síncrono no repository e o escopo "OS + Cliente simples"
**continuam valendo**; muda só o armazenamento do lado de leitura.

- **Provisionamento (Feature #315).** Módulo `docdb-read-model` no
  `repo-db-infra`: cluster `tc3-docdb-<env>` (engine `docdb` 5.0, uma
  instância `db.t4g.medium`, storage criptografado, TLS obrigatório), subnet
  group nas subnets privadas do `repo-k8s-infra` e security group na porta
  27017 com a mesma política de ingress do RDS (HML por CIDR, PROD por SG).
  Outputs `docdb_endpoint`, `docdb_port`, `docdb_name`, `docdb_secret_arn`.
- **Credenciais.** Secret `tc3-docdb-os-<env>`, JSON
  `{username,password,host,port,dbname}`, mesmo contrato dos secrets
  relacionais. O pipeline do OS o materializa como `DOCDB_*` no secret do
  namespace. **A IRSA e a role de IAM foram removidas**: o acesso é por
  usuário e senha, via TLS com o bundle de CA da AWS. **Dívida registrada:**
  o OS Service usa o usuário master do cluster (único consumidor); um
  usuário restrito à coleção exige um passo de bootstrap com `mongosh`.
- **Mapeamento.** Tabela vira coleção, item vira documento, chave de
  partição vira `_id` (`ordemServicoId`, `clienteId`), GSI esparso vira
  índice composto **parcial** (`partialFilterExpression` sobre `filaGrupo`),
  `Query`/`GetItem` viram `find`/`findOne`, e a paginação passa a usar
  `limit` com cursor por `filaOrdem`. Coleções e índices são criados de forma
  idempotente pelo OS Service, não pelo Terraform (`persistence-model.md`).
- **Custo (consequência aceita).** O DocumentDB não tem free tier contínuo e
  a instância é cobrada por hora; em HML o `down.yml` destrói o cluster, e a
  ausência de réplica é aceita porque o read model é reconstruível.
- **Dependências removidas.** O `@aws-sdk/lib-dynamodb` sai do desenho; entra
  o driver `mongodb`. O `repo-db-infra` deixa de ler o OIDC provider do
  `repo-k8s-infra`.

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
- Documentação oficial do Amazon DocumentDB (índices, índices parciais, TLS) e do driver `mongodb`
