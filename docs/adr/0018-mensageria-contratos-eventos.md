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
anterior de RabbitMQ. **Custo marginal**: sem serviço gerenciado à parte,
mas com nós `t3.medium` e um volume EBS para o broker (ver "Risco de
memória do Kafka e dimensionamento do node group"). Roda igual em ambiente
local e em HML, e o `repo-k8s-infra` já instala três charts por Terraform
(`aws-load-balancer-controller`, `metrics-server`, `nri-bundle`); o padrão de
instalação por `helm_release` já existe e é estável. A instalação em si, a
topologia de tópicos aplicada em HML e a entrega de credenciais aos serviços
são escopo da Feature #314 ("Provisionar a Plataforma de Mensageria"), não
desta ADR — aqui fecha-se a escolha do broker e o vocabulário/contrato que
todos os três serviços adotam desde o primeiro evento.

**Imagem e chart do Kafka (decidido na revisão de 30/09/2026).** Chart
Bitnami `kafka` (OCI) com **versão fixa** e imagens sobrescritas para
`bitnamilegacy/*` (o catálogo gratuito `bitnami/*` foi descontinuado em 2025). O chart
cobre por values o que a ADR exige: KRaft, SASL/SCRAM, provisionamento de
tópicos e persistência.

- **Go/no-go**: `docker pull` do tag exato (broker e imagens auxiliares do
  chart) na preparação da Sprint 7 (#314), antes de depender dele.
- **Plano B** (se o go/no-go falhar): chart próprio mínimo (StatefulSet + Job
  de criação de tópicos) com a imagem oficial `apache/kafka`, usando
  **SASL/PLAIN em vez de SCRAM** — desvio registrado desta ADR (SCRAM
  exigiria bootstrap manual das credenciais no armazenamento KRaft, que o
  chart Bitnami faz sozinho).
- **Strimzi descartado**: ~0,5 GiB a mais de operador num cluster já
  apertado em memória, e credenciais geradas dentro do cluster, o que
  conflita com o fluxo `random_password` → Secrets Manager adotado no projeto.
- **Risco aceito**: `bitnamilegacy/*` é um repositório congelado, **sem
  patches** de segurança, e pode ser removido; aceito para HML e para o
  prazo da Fase 4.

**Persistência do broker.** O broker persiste em um PVC EBS. Isso exige o
addon `aws-ebs-csi-driver` com IRSA (policy `AmazonEBSCSIDriverPolicy`) no
`repo-k8s-infra`, **hoje ausente** em `modules/eks/main.tf`. Risco aceito em
HML: o PV EBS fica preso a uma AZ, o que pode deixar o pod do broker sem nó
elegível se o nó SPOT daquela AZ for reciclado.

**Biblioteca cliente: `kafkajs` direto**, com um wrapper fino **duplicado por
serviço** (coerente com a duplicação de tipos de evento, abaixo). O
`kafkajs` é instrumentado nativamente pelo agente New Relic 14.x.
`@nestjs/microservices` e o cliente da Confluent foram descartados.

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
  confirmado" antes de "orçamento aprovado" para a mesma OS. **Limite da
  garantia**: a ordem por chave vale **somente dentro de um tópico** e é
  **quebrada pelo retry topic** — uma mensagem que falha vai para
  `<servico>.retry.v1` e as seguintes da mesma OS, no tópico principal, são
  processadas antes dela. Entre tópicos diferentes (ex.: `billing.eventos.v1`
  e `execucao.eventos.v1`) não há ordem alguma. Por isso o consumidor
  classifica a falha pelo estado atual da OS (ver "Classificação de falha no
  consumidor").
- **3 partições por tópico** (conforme #314).
- **Um consumer group por serviço consumidor**, nomeado `<servico>-consumer`
  (`os-consumer`, `billing-consumer`, `execucao-consumer`) — cada serviço
  interessado no tópico de outro mantém o próprio offset, equivalente
  Kafka de "fila por consumidor" sem precisar criar um objeto de fila novo.
  Quais tópicos e eventos cada grupo assina está na tabela "Assinaturas por
  serviço" de [`event-catalog.md`](../architecture/event-catalog.md).
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
| `correlationId` | string (UUID) | **Sempre igual ao `ordemServicoId`**, em todos os eventos da saga, incluindo os de compensação. Determinístico: qualquer serviço o calcula a partir da OS. Não é o `x-correlation-id` HTTP da Fase 3 (Lambda Authorizer, Gateway, Pino), que continua existindo mas vira só o id de requisição nos logs. |
| `producer` | string | Serviço que publicou o evento: `"os-service"`, `"billing-service"` ou `"execucao-producao-service"`. |
| `data` | object | Payload específico do tipo de evento. |

**Regra desta ADR**: `correlationId` **é** o `ordemServicoId` (não é mera
coincidência numérica). A Saga coreografada não tem reentrância (uma única
execução de saga por OS, do `RECEIVED` até o encerramento), então a OS
identifica a saga inteira; e como a regra é determinística, um serviço que
nunca viu o `OrdemServicoRecebida` (ex.: o detector de OS parada, ou o
consumidor de uma DLT) calcula o `correlationId` sem consultar ninguém. O
campo continua no envelope (para o rastreio não depender de abrir o
`data`), assim como `ordemServicoId` continua dentro de `data` e como chave
de partição do registro Kafka. Reprocessamento administrativo reaproveita o
mesmo `correlationId`; não há `correlationId` divergente.

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
5. **A DLT não é o fim da linha**: o consumidor do tópico DLT publica o
   evento de falha técnica `EtapaDaSagaFalhou` (conforme a diretriz já
   registrada na #314 — "DLT → evento de falha → compensação"), no tópico
   `*.eventos.v1` do próprio serviço que falhou, com o campo `etapa`
   indicando onde a saga parou, para que os demais serviços interessados
   possam compensar. O **detector de OS parada** (ver "Garantias de
   publicação") publica o mesmo evento quando uma OS passa do prazo numa
   etapa. Payload: ver "Eventos de falha da saga" abaixo.

### Classificação de falha no consumidor

Nem toda falha merece retry: como a ordem por chave só vale dentro de um
tópico e é quebrada pelo retry topic (ver "Topologia"), o consumidor decide
pelo **estado atual da OS** (ou do agregado local) comparado ao que o evento
pressupõe:

| Situação | Tratamento |
|---|---|
| Estado atual **abaixo** do esperado (o evento anterior ainda não foi processado, ex.: `ExecucaoIniciada` antes de `OrcamentoGerado`) | **Erro retentável**: lança, entra no ciclo de retry (3 tentativas, backoff por `notBefore`). |
| Estado atual **igual ou acima** do esperado, ou OS em estado terminal (evento repetido ou obsoleto) | **Ack e ignora**, com log. É a idempotência do consumidor; não retenta nem vai à DLT. |
| **Erro de negócio** que não se resolve sozinho (ex.: `ExecucaoConcluida` com a OS em `AWAITING_PARTS`) | **Não retenta.** Registra o motivo em `HistoricoStatusOS` e publica `EtapaDaSagaFalhou` com `etapa=reparo` (caminho manual, sem compensação automática). |

Casos específicos já decididos:

- `OrcamentoAprovado` consumido com a OS já `CLOSED_WITHOUT_EXECUTION`:
  **não reserva** peças (ack e ignora, com log).
- O Billing **ignora** um `OrcamentoCalculado` repetido depois da aprovação
  do orçamento; não lança `DomainException`.

### Eventos de falha da saga

A saga distingue dois tipos de falha, e **só o segundo é um evento
genérico**:

- **Recusa de negócio** — resultado válido de uma etapa, não é erro de
  processamento e não passa pelo ciclo de retry. Cada uma tem **evento
  próprio**, publicado pelo **Billing Service** em `billing.eventos.v1` e
  consumido pelo **OS Service**: `OrcamentoRecusado` (cliente recusa o
  orçamento) e `PagamentoRecusado` (Mercado Pago devolve status terminal
  `rejected` ou `cancelled`).
- **Falha técnica** — exceção que esgotou o retry (DLT) ou OS parada além do
  prazo (detector). Vira sempre **um único evento**, `EtapaDaSagaFalhou`.
  Substitui os antigos `OrcamentoGeracaoFalhou` e `ExecucaoInicioFalhou`,
  que deixam de existir.

Payload de `EtapaDaSagaFalhou` (campo `data` do envelope):

| Campo | Descrição |
|---|---|
| `servicoOrigem` | Serviço em que o processamento falhou (ou que detectou a OS parada): `"os-service"`, `"billing-service"` ou `"execucao-producao-service"`. O detector publica sempre `"os-service"`. |
| `eventTypeOriginal` | `eventType` da mensagem que falhou (na DLT). **`null` quando publicado pelo detector de OS parada** (não há mensagem original). |
| `ordemServicoId` | Identificador da OS afetada. |
| `etapa` | Onde a saga parou: `diagnostico`, `orcamento`, `aprovacao-pagamento`, `inicio-execucao` ou `reparo`. Na DLT, sai do `eventType` da mensagem que falhou (tabela "evento original → etapa" em [`saga-flow.md`](../architecture/saga-flow.md) §3). |
| `motivo` | Mensagem resumida da falha (`lastError` na DLT; descrição do prazo excedido no detector). |

Os três serviços consomem `EtapaDaSagaFalhou` e cada um aplica a própria
compensação conforme a `etapa`, de forma idempotente — a matriz
`etapa → falha → compensação` está em
[`saga-flow.md`](../architecture/saga-flow.md) §3. Todos os eventos de falha
entram no catálogo de integração
([`event-catalog.md`](../architecture/event-catalog.md)).

### Garantias de publicação

`acks=all` + produtor idempotente (`enable.idempotence=true`) em todos os
produtores. **Sem outbox transacional** em serviço nenhum (decisão já
registrada na #314): o evento é publicado diretamente após o commit da
transação local. A rede de proteção contra uma publicação que nunca
acontece (ex.: processo do serviço cai entre o commit e a publicação) é o
**detector de OS parada**, de responsabilidade do OS Service (especificado
na #314, implementado no épico do OS Service):

- Roda como **CronJob do Kubernetes** — uma execução por vez, sem duplicata
  mesmo com HPA nos pods do serviço.
- **Prazo configurável por variável de ambiente**, padrão **48 h**; na
  demonstração, alguns minutos.
- Na Fase 4 varre **apenas OS em `AWAITING_APPROVAL` com `pago_em` nulo**
  além do prazo e publica `EtapaDaSagaFalhou` com
  `etapa=aprovacao-pagamento`, `eventTypeOriginal = null` e
  `servicoOrigem = "os-service"` (cliente que não aprova ou não paga). OS já
  paga esperando o mecânico na fila de reparo não é varrida (o OS Service
  grava `pago_em` ao consumir `PagamentoConfirmado`). Não há
  `etapa=orcamento` nem `etapa=diagnostico` pelo detector.
- Como a publicação sai depois do commit (sem outbox), o detector cobre a
  perda de eventos **só na etapa de aprovação/pagamento**. Nas demais
  etapas, um evento perdido é **risco aceito** em HML, recuperado por
  replay manual.

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

**Critério go/no-go antes da Sprint 7.** Medido com Kafka + New Relic + os
três serviços no HPA mínimo, sobre os nós `t3.medium`:

1. soma dos `requests` ≤ **70 %** do `allocatable` dos nós;
2. **drain de 1 nó** sem nenhum pod em `Pending`;
3. Kafka sob carga (~1 mil msg/s por 5 min) com *working set* ≤ **85 %** do
   `limit` e **0 restarts em 30 min**.

**Escada de fallback**, na ordem, se algum critério falhar: (a) heap 512 m
com `limit` de 1 GiB; (b) HPA `min=1` em HML para Billing e Execução;
(c) nós `t3.large`; (d) trocar o broker por um compatível com a API Kafka
sem JVM (ex.: Redpanda — licença **não verificada**).

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
  usar Kafka já assume apenas custo marginal sobre o EKS já provisionado
  (nós `t3.medium` e um volume EBS, com o broker rodando dentro do próprio
  cluster); MSK é cobrado à parte, por
  broker e por hora, incompatível com o orçamento de conta acadêmica da
  Fase 4.

## Consequências positivas

- Vocabulário e contrato de evento fechados **antes** do primeiro evento
  ser publicado por qualquer um dos três serviços — evita reescrever o
  publicador em paralelo por três times.
- Replay por offset dá ao grupo uma forma real de reprocessar um fluxo de
  saga quebrado (inclusive como recurso de demonstração no vídeo de
  entrega), o que RabbitMQ não oferecia.
- `correlationId` = `ordemServicoId`, determinístico: qualquer serviço (e o
  detector de OS parada) o calcula sem depender de ter visto o primeiro
  evento, e o rastreio de uma OS no New Relic e nos logs parte de um
  identificador de negócio que o time já conhece.
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
  mitigada pelo detector de OS parada apenas na etapa de
  aprovação/pagamento; nas demais etapas é risco aceito, recuperado por
  replay manual.
- **Kafka é operacionalmente mais pesado que RabbitMQ** para o time operar
  em 8 semanas (JVM, heap, KRaft) — aceito conscientemente pelo grupo em
  troca do replay por offset.

## Riscos

- **Alto, sinalizado e mitigado em outra Feature**: consumo de memória do
  Kafka (JVM) frente à capacidade do node group — ver "Risco de memória do
  Kafka" acima. Mitigação (migração para `t3.medium`, medição de consumo
  real) é escopo da #313/#314, não desta ADR. O critério go/no-go e a escada
  de fallback estão na seção acima.
- **Médio**: broker de nó único (KRaft com controller e broker no mesmo
  pod, sem replicação) é um ponto único de falha, aceito para HML — decisão
  de infraestrutura tratada na #314, fora do escopo desta ADR.
- **Médio, aceito em HML**: PV EBS preso a uma AZ com nós SPOT; e o addon
  `aws-ebs-csi-driver` com IRSA ainda não existe no `repo-k8s-infra`
  (trabalho obrigatório para a persistência do broker).
- **Médio, aceito em HML**: imagem `bitnamilegacy/*` congelada, sem patches
  e sujeita a remoção (ver "Decisão"); mitigado pelo go/no-go (`docker pull`
  na Sprint 7) e pelo plano B (`apache/kafka` com SASL/PLAIN).
- **Baixo, aceito conscientemente**: um único usuário Kafka (SASL/SCRAM)
  compartilhado pelos três serviços por ambiente — isolamento fica no nível
  de tópico e consumer group, não de credencial (ACL por tópico registrada
  como evolução futura na #314, não avaliada nesta entrega).

## Revisão de 30/09/2026

Revisão do épico #306 (`rev/Epic_1`), alinhada a
[`saga-flow.md`](../architecture/saga-flow.md). A escolha do broker, a
topologia e o envelope **continuam valendo**. Mudou:

- Os eventos de falha de negócio `OrcamentoGeracaoFalhou` e
  `ExecucaoInicioFalhou` foram **extintos**; as falhas técnicas passam a ser
  um único `EtapaDaSagaFalhou`, agora com o campo `etapa`, emitido pela DLT
  e pelo detector de OS parada.
- Nomes de evento iguais aos do código: `OrdemServicoRecebida` (antes
  `OrdemDeServicoRecebida`) e `OrcamentoRecusado` (antes `OrcamentoRejeitado`).
- Novo evento `ExecucaoConcluida` (Execução e Produção → OS Service).
- `correlationId` = `ordemServicoId` em todos os eventos (regra
  determinística, não simplificação); o `x-correlation-id` HTTP vira só id
  de requisição nos logs.
- Nova seção "Classificação de falha no consumidor" (retentável / ignorar /
  erro de negócio) e registro de que a ordem por chave **só vale dentro de
  um tópico** e é quebrada pelo retry topic.
- Detector de OS parada: CronJob do Kubernetes, prazo por variável de
  ambiente (padrão 48 h), cobrindo só `AWAITING_APPROVAL`
  (`etapa=aprovacao-pagamento`).
- Kafka: persistência em PVC EBS (exige `aws-ebs-csi-driver` com IRSA no
  `repo-k8s-infra`); biblioteca cliente `kafkajs` direto com wrapper fino
  duplicado por serviço; "custo adicional zero" trocado por custo marginal
  (nós `t3.medium` + volume EBS); critério go/no-go antes da Sprint 7 e
  escada de fallback.
- Imagem e chart do Kafka decididos: chart Bitnami `kafka` (OCI) em versão
  fixa com imagens `bitnamilegacy/*`; go/no-go por `docker pull` na Sprint 7;
  plano B com chart próprio e `apache/kafka` (SASL/PLAIN); Strimzi descartado.
- Modelo híbrido do Execução e Produção: novo evento `DiagnosticoIniciado`;
  o Execução passa a consumir `OrdemServicoRecebida` e `PagamentoConfirmado`
  (e as recusas) e o OS Service passa a consumir `PagamentoConfirmado` (só
  `pago_em`); `ExecucaoIniciada` passa a significar "mecânico iniciou o
  reparo".
- `EtapaDaSagaFalhou`: `etapa` ganha `diagnostico`; tabela "evento original →
  etapa" em `saga-flow.md` §3; no detector, `eventTypeOriginal = null` e
  `servicoOrigem = "os-service"`; o detector ignora OS com `pago_em`
  preenchido.

## Referências

- Tech Challenge — Fase 4 (`12SOAT - Fase 4 - Tech challenge.pdf`), p.4 e p.5
- `fase4-decisoes-epico1.md` (workspace local do grupo), §F3
- Issue [#309](https://github.com/Async-And-Furious/async-furious-project/issues/309) — Definir Mensageria e Contratos de Eventos
- Issue [#313](https://github.com/Async-And-Furious/async-furious-project/issues/313) — Preparar o Cluster para Múltiplos Serviços (risco de memória e node group)
- Issue [#314](https://github.com/Async-And-Furious/async-furious-project/issues/314) — Provisionar a Plataforma de Mensageria (Kafka) (instalação, topologia aplicada, credenciais)
- [ADR-0009 — Eventos de domínio in-process](./0009-eventos-dominio-in-process.md) (parcialmente substituída por esta ADR para comunicação entre serviços)
- [ADR-0016 — Saga coreografada](./0016-saga-coreografada.md)
- [ADR-0017 — Divisão em três microsserviços e ownership de dados](./0017-divisao-microsservicos-ownership-dados.md)
- [`docs/architecture/saga-flow.md`](../architecture/saga-flow.md) — fluxo detalhado (fonte única) que motiva os eventos formalizados nesta ADR
- [`docs/architecture/event-catalog.md`](../architecture/event-catalog.md) — catálogo de eventos de integração (produtor/consumidores)
- [`docs/ddd.md`](../ddd.md) §5 — catálogo de eventos de domínio existentes
- Documentação oficial do Apache Kafka — modo KRaft, consumer groups, produtor idempotente (`acks=all`, `enable.idempotence`)
