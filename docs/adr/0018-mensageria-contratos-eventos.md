# ADR-0018: Kafka como broker de eventos e contrato padrão de evento da Fase 4

## Status

Aceita

## Contexto

A Fase 4 divide o monólito em três microsserviços — **OS Service**,
**Billing Service** e **Execução e Produção** — segundo a
[ADR-0017](./0017-divisao-microsservicos-ownership-dados.md), coordenados
por uma **Saga coreografada** segundo a [ADR-0016](./0016-saga-coreografada.md):
não há orquestrador central, e cada serviço reage a eventos publicados
pelos outros dois para avançar ou compensar o fluxo de Ordem de Serviço
(`docs/architecture/saga-flow.md`).

Hoje o projeto **não tem broker de mensageria algum**. Os eventos de
domínio são emitidos e tratados dentro do mesmo processo, via o
`EmissorEventos` ([ADR-0009](./0009-eventos-dominio-in-process.md)), sem
persistência nem replay. Essa ADR deixa de valer para a comunicação
**entre** os três serviços a partir desta decisão — ela continua vigente,
sem alteração, apenas para a comunicação **interna** ao OS Service (entre
os Bounded Contexts `ordem-servico`, `cadastro` e `pecas-insumos`, que
seguem no mesmo processo).

Sem um broker e um contrato de evento fechados antes do primeiro evento de
integração ser publicado, a decisão teria que ser tomada depois em paralelo
por três times diferentes — o que na prática significa reescrever o
publicador em três serviços já em desenvolvimento. Com a Saga coreografada,
o problema é maior que retrabalho: o envelope de evento (em particular o
`correlationId`) é o **único mecanismo de rastreio** do fluxo distribuído,
já que não existe um orquestrador nem um registro central de "estado da
saga" (ver [ADR-0016](./0016-saga-coreografada.md) §"Rastreabilidade sem
estado central").

Decisão fechada pelo grupo em 21/09/2026, registrada em
`fase4-decisoes-epico1.md` §F3 (workspace local do grupo, fora do
repositório).

## Decisão

### Broker: Kafka em modo KRaft

O broker de mensageria da Fase 4 é o **Apache Kafka**, instalado no cluster
EKS via Helm em modo **KRaft** (sem Zookeeper), substituindo a recomendação
anterior de RabbitMQ. Custo adicional zero sobre o EKS já provisionado —
roda igual em ambiente local e em HML — e o `repo-k8s-infra` já instala
três charts por Terraform (`aws-load-balancer-controller`, `metrics-server`,
`nri-bundle`); o padrão de instalação por `helm_release` já existe e é
estável. A instalação em si, a topologia de tópicos aplicada em HML e a
entrega de credenciais aos serviços são escopo da Feature #314
("Provisionar a Plataforma de Mensageria"), não desta ADR — aqui fecha-se
a escolha do broker e o vocabulário/contrato que todos os três serviços
adotam desde o primeiro evento.

### Vocabulário: tópico, partição, consumer group

O vocabulário de mensageria passa a ser o do Kafka, não o do RabbitMQ:
**tópico + partição + consumer group**, não exchange, fila e routing key.
Duas consequências diretas:

- Não existe dead-letter-exchange nativo no Kafka: retry e DLQ são
  implementados **na aplicação**, como **retry topics** e **dead-letter
  topic**, não como objetos nativos do broker.
- `publisher confirms` (RabbitMQ) vira **`acks=all` + produtor idempotente**
  (`enable.idempotence=true`) — a garantia equivalente de que uma mensagem
  publicada não se perde nem duplica no lado do produtor.
- O consumo em Kafka tem **offset**, o que dá **replay** — vantagem real
  sobre o desenho anterior: permite reprocessar um fluxo quebrado (útil,
  inclusive, para demonstrar o comportamento durante a gravação do vídeo).

### Topologia de tópicos, partição e consumer groups

A topologia é a definida e provisionada pela Feature #314, reafirmada aqui
como o contrato que o envelope e os eventos desta ADR pressupõem — **não
redecidida nesta ADR**:

- **Um tópico por serviço produtor**: `os.eventos.v1`, `billing.eventos.v1`,
  `execucao.eventos.v1`. O tipo do evento vai no campo `eventType` do
  envelope, não no nome do tópico — um tópico por tipo de evento
  multiplicaria objetos e quebraria a garantia de ordem entre eventos
  correlatos da mesma OS.
- **Chave da mensagem (partição) = `ordemServicoId`**, em todos os tópicos
  `*.eventos.v1` — garante que todos os eventos de uma mesma OS caiam na
  mesma partição e sejam consumidos em ordem. Essencial numa saga
  coreografada: sem essa garantia, um consumidor poderia ver "pagamento
  confirmado" antes de "orçamento aprovado" para a mesma OS.
- **3 partições por tópico** (conforme #314).
- **Um consumer group por serviço consumidor**, nomeado `<servico>-consumer`
  (`os-consumer`, `billing-consumer`, `execucao-consumer`) — cada serviço
  interessado no tópico de outro mantém o próprio offset, equivalente
  Kafka de "fila por consumidor" sem precisar criar um objeto de fila novo.
- **Retry e dead-letter por serviço**: `<servico>.retry.v1` e
  `<servico>.dlt.v1`, populados pelo próprio consumidor quando o
  processamento de uma mensagem falha (ver "Estratégia de retry e
  dead-letter" abaixo).

### Envelope padrão de evento

Todo evento de integração publicado em `*.eventos.v1` usa o mesmo envelope,
desde o primeiro evento publicado:

| Campo | Tipo | Descrição |
|---|---|---|
| `eventId` | string (UUID v4) | Identificador único desta instância do evento — permite deduplicar no consumidor caso o mesmo evento chegue mais de uma vez (reentrega, replay). |
| `eventType` | string | Nome do evento, igual ao já catalogado em `docs/ddd.md` §5 ou no catálogo de integração (`docs/architecture/event-catalog.md`), ex. `"OrcamentoCalculado"`. |
| `eventVersion` | integer | Versão do schema do payload deste tipo de evento. Começa em `1`; incrementa em mudança incompatível do campo `data`. |
| `occurredAt` | string (ISO-8601, UTC) | Instante em que o evento ocorreu no serviço produtor. |
| `correlationId` | string (UUID) | Nasce no evento `OrdemDeServicoRecebida` e é propagado **sem alteração** por todos os eventos subsequentes da mesma OS, incluindo os de compensação — é o mesmo identificador de correlação já usado nos logs e no Lambda Authorizer da Fase 3 (`repo-auth-serverless`), agora estendido ao broker. |
| `producer` | string | Serviço que publicou o evento: `"os-service"`, `"billing-service"` ou `"execucao-producao-service"`. |
| `data` | object | Payload específico do tipo de evento. |

**Nota desta ADR**: como a Saga coreografada não tem reentrância (uma única
execução de saga por OS, do `RECEIVED` até o encerramento), `correlationId`
e o `ordemServicoId` de negócio coincidem numericamente na prática. Ainda
assim os dois campos são conceitualmente distintos e mantidos separados no
envelope: `correlationId` é o identificador de rastreamento (linhagem com a
Fase 3), `ordemServicoId` é um dado de negócio dentro de `data` **e** a
chave de partição do registro Kafka. Essa equivalência numérica é uma
simplificação de implementação assumida por esta ADR, não uma regra a
reforçar em código — nada impede um `correlationId` divergente do
`ordemServicoId` se uma necessidade futura exigir (ex.: reprocessamento
administrativo com novo `correlationId` sobre a mesma OS).

**Exemplo real de payload** — evento `OrcamentoCalculado`, publicado pelo OS
Service em `os.eventos.v1`, consumido pelo Billing Service via
`billing-consumer` (fluxo detalhado em `docs/architecture/saga-flow.md` §1):

```json
{
  "eventId": "0b2b6f0a-9b8b-4c1e-8a2b-7e6f6b2c9e11",
  "eventType": "OrcamentoCalculado",
  "eventVersion": 1,
  "occurredAt": "2026-09-22T14:32:07.481Z",
  "correlationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "producer": "os-service",
  "data": {
    "ordemServicoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "valorTotalServicos": 450.00,
    "valorTotalPecas": 320.50,
    "valorTotalGeral": 770.50
  }
}
```

Registro Kafka correspondente: `topic=os.eventos.v1`,
`key=3fa85f64-5717-4562-b3fc-2c963f66afa6` (o mesmo `ordemServicoId`, como
string, fora do JSON do envelope — é a chave do registro, não um campo do
`data`, mas duplicado dentro de `data` para que o consumidor não precise
inspecionar metadado de transporte para obter um dado de negócio).

### Estratégia de retry e dead-letter

Implementada inteiramente na aplicação, porque o Kafka não tem
dead-letter-exchange nativo:

1. O consumidor tenta processar a mensagem do tópico `*.eventos.v1`.
2. Se falhar, publica a mesma mensagem em `<servico>.retry.v1`, com um
   bloco `retry` adicional no envelope:

   ```json
   {
     "...": "...(mesmo envelope acima)",
     "retry": {
       "attempt": 1,
       "firstFailedAt": "2026-09-22T14:32:09.100Z",
       "notBefore": "2026-09-22T14:32:39.100Z"
     }
   }
   ```

   Não existe `x-message-ttl` em Kafka: o backoff é obtido pausando o
   consumo do tópico de retry até `notBefore`, ou descartando mensagens
   cujo `notBefore` ainda não chegou e reprocessando no próximo poll.
3. **3 tentativas** no total (conforme #314). Esgotadas, a mensagem vai
   para `<servico>.dlt.v1`, com `retry.attempt=3` e um campo adicional
   `lastError` (mensagem resumida da última falha).
4. **Critério de descarte**: uma mensagem só é considerada "descartada" (não
   mais reprocessada automaticamente) ao chegar à `dlt.v1` depois da
   terceira tentativa falha. Ela **permanece no tópico DLT** (não é
   apagada) — o histórico e o replay continuam possíveis via offset.
5. **A DLT não é o fim da linha**: o consumidor do tópico DLT publica um
   evento de falha genérico, `EtapaDaSagaFalhou` (proposto por esta ADR,
   conforme a diretriz já registrada na #314 — "DLT → evento de falha →
   compensação"), no tópico `*.eventos.v1` do próprio serviço que falhou,
   para que os demais serviços interessados possam compensar. Payload
   mínimo: `servicoOrigem`, `eventTypeOriginal`, `ordemServicoId`, `motivo`.
   Este evento cobre falhas **técnicas** de processamento (exceção,
   indisponibilidade) — é diferente dos eventos de falha **de negócio**
   já nomeados abaixo, que não passam pelo ciclo de retry porque não são
   erro de processamento, são um resultado de negócio válido.

### Dois eventos de falha de negócio, formalizados por esta ADR

O documento `docs/architecture/saga-flow.md` (Feature #308/ADR-0016) já
desenhava dois pontos da saga em que o serviço não consegue completar sua
etapa por razão de negócio (não por falha técnica de processamento) e
deixava o nome do evento **"a formalizar com a #309"**. Esta ADR fecha os
dois nomes, seguindo o mesmo estilo dos eventos de negócio já catalogados
(`OrcamentoRejeitado`, `PagamentoRecusado`):

- **`OrcamentoGeracaoFalhou`** — publicado pelo **Billing Service** em
  `billing.eventos.v1` quando não consegue persistir o documento de
  orçamento a partir de um `OrcamentoCalculado` recebido (ex.: falha de
  banco no Billing Service). Consumido pelo **OS Service**, que fecha a OS
  como `CLOSED_WITHOUT_EXECUTION`.
- **`ExecucaoInicioFalhou`** — publicado pelo **Execução e Produção** em
  `execucao.eventos.v1` quando não consegue iniciar a execução após
  `PagamentoConfirmado` (ex.: indisponibilidade de peça identificada só
  nesta etapa, capacidade de oficina esgotada). Consumido pelo **Billing
  Service** (aciona o estorno real no Mercado Pago, já que o pagamento foi
  capturado) e pelo **OS Service** (fecha a OS como
  `CLOSED_WITHOUT_EXECUTION`).

Os dois entram no catálogo de eventos de integração
(`docs/architecture/event-catalog.md`), junto com os demais eventos `[novo]`
que `saga-flow.md` já vinha antecipando (`OrcamentoCalculado`,
`PagamentoConfirmado`, `PagamentoRecusado`, `ExecucaoIniciada`).

### Garantias de publicação

`acks=all` + produtor idempotente (`enable.idempotence=true`) em todos os
produtores. **Sem outbox transacional** em serviço nenhum (decisão já
registrada na #314): o evento é publicado diretamente após o commit da
transação local. A rede de proteção contra uma publicação que nunca
acontece (ex.: processo do serviço cai entre o commit e a publicação) é o
**detector de OS parada**, de responsabilidade do OS Service (especificado
na #314, implementado no épico do OS Service) — varre OS em estado
intermediário além do prazo esperado e publica o evento de falha
correspondente.

### Duplicação de tipos de evento por serviço (sem pacote npm compartilhado)

Os tipos de evento (schemas/DTOs de `data` por `eventType`) são
**duplicados em cada serviço**, não distribuídos por um pacote npm
compartilhado. Um pacote compartilhado foi avaliado e descartado: ele
reacopla os três serviços — exatamente o acoplamento que a divisão em
microsserviços busca evitar — e exige infraestrutura própria de publicação
e versionamento de pacote (registry privado ou público, pipeline de
release do pacote) que não cabe no prazo de 8 semanas da Fase 4. O contrato
que os três serviços compartilham de fato é o **catálogo documentado**
(`docs/architecture/event-catalog.md`), não código compilado.

### Risco de memória do Kafka e dimensionamento do node group

Kafka roda em JVM e consome mais memória que o RabbitMQ (que havia sido a
recomendação anterior) — hoje **o maior risco de infraestrutura da Fase 4**.
Esse risco já foi identificado e mitigado por outra Feature do mesmo Epic
(#312 → **#313**, "Preparar o Cluster para Múltiplos Serviços"), **não
redecidido aqui**:

- O gargalo medido não é slot de pod (ENI do VPC CNI), é memória: um heap
  conservador de Kafka pede ~1 GiB, e o node group atual (`t3.small`, 2 GiB)
  não comporta isso com folga.
- Decisão já fechada em #313: **migrar o node group para `t3.medium`**, com
  o DynamoDB (decisão de persistência do Epic #306) ficando fora do
  cluster — sobra capacidade só para o Kafka e os três serviços.
- A medição real de consumo de memória do broker (via `kubectl describe
  node` e subida isolada do chart) e o ajuste fino do heap (`-Xmx`/`-Xms`)
  ficam para a #313/#314, antes da Sprint 7 — esta ADR só registra o risco
  e aponta para onde ele é mitigado, não fixa o valor de heap.

## Alternativas consideradas

- **RabbitMQ** — recomendação anterior do grupo, descartada. Não oferece
  replay nativo por offset (relevante para reprocessar uma etapa da saga
  quebrada) e o vocabulário de exchange/routing-key/fila não muda a
  complexidade de implementar retry e DLQ na aplicação — o grupo teria o
  mesmo trabalho de implementar DLQ manualmente, sem o ganho de replay.
- **SQS + SNS (AWS gerenciado)** — descartado. Não dá ordenação por chave de
  partição de forma nativa sem usar filas FIFO (que trocam throughput por
  ordem e complicam fan-out para múltiplos consumidores por tópico); não
  tem offset/replay — uma mensagem consumida (e removida ou expirada da
  fila) não pode ser relida para reconstruir o histórico de uma OS, ao
  contrário do Kafka.
- **Amazon MQ (RabbitMQ gerenciado)** — descartado pelo mesmo motivo do
  RabbitMQ auto-hospedado, mais o custo mensal do serviço gerenciado em
  conta AWS acadêmica, sem o ganho de operar RabbitMQ estar sendo evitado
  (o grupo teria a complexidade operacional de um serviço gerenciado sem o
  ganho de replay do Kafka).
- **MSK (Kafka gerenciado pela AWS)** — descartado por custo. A decisão de
  usar Kafka já assume custo adicional zero sobre o EKS já provisionado
  (broker rodando dentro do próprio cluster); MSK é cobrado à parte, por
  broker e por hora, incompatível com o orçamento de conta acadêmica da
  Fase 4.

## Consequências positivas

- Vocabulário e contrato de evento fechados **antes** do primeiro evento
  ser publicado por qualquer um dos três serviços — evita reescrever o
  publicador em paralelo por três times.
- Replay por offset dá ao grupo uma forma real de reprocessar um fluxo de
  saga quebrado (inclusive como recurso de demonstração no vídeo de
  entrega), o que RabbitMQ não oferecia.
- `correlationId` propagado no envelope, herdado do padrão já usado nos
  logs e no Lambda Authorizer da Fase 3, evita inventar um segundo esquema
  de rastreamento para a Fase 4.
- Catálogo de eventos documentado (não pacote compilado) mantém os três
  serviços desacoplados em tempo de build/deploy — nenhum serviço depende
  do ciclo de release de outro para consumir um evento.

## Consequências negativas

- **Tipos duplicados por serviço**: mudança de schema de um evento exige
  editar o tipo em pelo menos dois serviços (produtor e cada consumidor),
  manualmente, sem checagem de compatibilidade em tempo de build entre eles
  — mitigado apenas pela disciplina de versionar (`eventVersion`) e manter
  o catálogo em `docs/architecture/event-catalog.md` atualizado.
- **Sem outbox transacional**: existe uma janela, por menor que seja, entre
  o commit da transação local e a publicação no Kafka em que um crash do
  processo perde o evento sem que ninguém mais tente publicá-lo de novo —
  mitigada apenas pelo detector de OS parada (job periódico, não uma
  garantia de entrega imediata).
- **Kafka é operacionalmente mais pesado que RabbitMQ** para o time operar
  em 8 semanas (JVM, heap, KRaft) — aceito conscientemente pelo grupo em
  troca do replay por offset.

## Riscos

- **Alto, sinalizado e mitigado em outra Feature**: consumo de memória do
  Kafka (JVM) frente à capacidade do node group — ver "Risco de memória do
  Kafka" acima. Mitigação (migração para `t3.medium`, medição de consumo
  real) é escopo da #313/#314, não desta ADR.
- **Médio**: broker de nó único (KRaft com controller e broker no mesmo
  pod, sem replicação) é um ponto único de falha, aceito para HML — decisão
  de infraestrutura tratada na #314, fora do escopo desta ADR.
- **Baixo, aceito conscientemente**: um único usuário Kafka (SASL/SCRAM)
  compartilhado pelos três serviços por ambiente — isolamento fica no nível
  de tópico e consumer group, não de credencial (ACL por tópico registrada
  como evolução futura na #314, não avaliada nesta entrega).

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.4 e p.5
- `fase4-decisoes-epico1.md` (workspace local do grupo), §F3
- Issue [#309](https://github.com/Async-And-Furious/async-furious-project/issues/309) — Definir Mensageria e Contratos de Eventos
- Issue [#313](https://github.com/Async-And-Furious/async-furious-project/issues/313) — Preparar o Cluster para Múltiplos Serviços (risco de memória e node group)
- Issue [#314](https://github.com/Async-And-Furious/async-furious-project/issues/314) — Provisionar a Plataforma de Mensageria (Kafka) (instalação, topologia aplicada, credenciais)
- [ADR-0009 — Eventos de domínio in-process](./0009-eventos-dominio-in-process.md) (parcialmente substituída por esta ADR para comunicação entre serviços)
- [ADR-0016 — Saga coreografada](./0016-saga-coreografada.md)
- [ADR-0017 — Divisão em três microsserviços e ownership de dados](./0017-divisao-microsservicos-ownership-dados.md)
- [`docs/architecture/saga-flow.md`](../architecture/saga-flow.md) — fluxo detalhado que motiva os eventos `[novo]` formalizados nesta ADR
- [`docs/architecture/event-catalog.md`](../architecture/event-catalog.md) — catálogo de eventos de integração (produtor/consumidores)
- [`docs/ddd.md`](../ddd.md) §5 — catálogo de eventos de domínio existentes
- Documentação oficial do Apache Kafka — modo KRaft, consumer groups, produtor idempotente (`acks=all`, `enable.idempotence`)
