# ADR-0005: Estratégia de observabilidade

## Status

Aceita — decisão de ferramenta tomada (New Relic), instrumentação e
integração de infraestrutura implementadas em código na issue
[#163](https://github.com/Async-And-Furious/async-furious-project/issues/163),
logs estruturados da aplicação implementados em código na issue
[#164](https://github.com/Async-And-Furious/async-furious-project/issues/164)
(branch `feat/I-164_ImplementarLogsEstruturados`, a partir da branch do
#163 — o agente New Relic ainda não estava em `develop` quando #164
começou).
**Pendente**: validação end-to-end (telemetria e logs chegando de fato no
New Relic) e dashboards/alertas (issues #166/#167), ainda não iniciados.

## Contexto

A Fase 3 exige observabilidade (logs, métricas, tracing) como parte da
arquitetura distribuída. Uma auditoria anterior (que originou a primeira
versão deste documento) buscou por qualquer evidência de observabilidade em
todo o repositório e nos três repositórios satélite e encontrou zero
resultados — nenhuma ferramenta, nenhuma dependência de logging/métricas/APM,
nenhuma RFC ou ADR mencionando o tema. Essa ausência ficou registrada de
propósito, em vez de omitida, com a recomendação explícita de abrir uma RFC
dedicada quando o grupo decidisse uma ferramenta.

O grupo decidiu **New Relic** (epic
[#162](https://github.com/Async-And-Furious/async-furious-project/issues/162)),
sem uma comparação formal documentada contra alternativas (CloudWatch,
Prometheus/Grafana, Datadog) — a escolha já veio definida no planejamento do
épico, não como resultado de uma avaliação de trade-offs registrada aqui.

## Decisão

Adotar o **New Relic** (plano gratuito — 100 GB/mês de ingestão, sem cartão
de crédito) como plataforma única de observabilidade, cobrindo APM da
aplicação, infraestrutura do cluster Kubernetes e logs.

### O que foi implementado (issue #163)

- **Instrumentação da aplicação** (`async-furious-project`, branch
  `feat/I-163_EstruturarPlataformaObservabilidade`): agente `newrelic`
  (pacote npm) importado como primeira linha de `src/main.ts` — instrumenta
  automaticamente HTTP, driver do Prisma e chamadas externas. Configuração
  100% via variável de ambiente (`NEW_RELIC_NO_CONFIG_FILE=true`, sem
  `newrelic.js` versionado), seguindo o mesmo padrão 12-factor já usado para
  `JWT_SECRET`/`DATABASE_URL`. Nome da aplicação diferenciado por ambiente
  (`async-furious-project-hml` / `async-furious-project-prod`).
- **Integração de infraestrutura do cluster** (`repo-k8s-infra`, mesma
  branch): Helm chart oficial `nri-bundle` (versão `8.0.24`), aplicado via
  `helm_release` no Terraform — mesmo mecanismo já usado para o AWS Load
  Balancer Controller e o Metrics Server. Componentes habilitados,
  deliberadamente mínimos por causa da capacidade limitada dos nós EKS em
  conta AWS Academy:
  - `newrelic-infrastructure` — agente de infraestrutura (DaemonSet, métricas
    de CPU/memória/disco por nó).
  - `newrelic-logging` — Fluent Bit, encaminha o stdout dos pods para o New
    Relic (pré-requisito da issue #164 de logs estruturados).
  - `kube-state-metrics` — estado dos objetos Kubernetes (réplicas
    desejadas vs. rodando, etc.).

  Deixados **desabilitados** por ora: `nri-metadata-injection` (webhook de
  admissão mutante — risco desproporcional num cluster pequeno antes de
  validar o básico), `nri-kube-events`, `newrelic-prometheus-agent` e Pixie
  (custo de recursos sem necessidade imediata). `global.lowDataMode = true`
  reduz volume de ingestão, compatível com o plano gratuito.
- **Segredos**: a license key nunca é commitada — vive como secret do
  GitHub (`NEW_RELIC_LICENSE_KEY`, duplicado nos dois repositórios porque
  GitHub não compartilha secrets entre repos) e é materializada como
  Kubernetes Secret em dois lugares diferentes: no `async-furious-project`,
  via `kubectl create secret` no pipeline de deploy (mesmo padrão do
  `JWT_SECRET`); no `repo-k8s-infra`, indiretamente — o chart `nri-bundle`
  cria seu próprio Secret a partir do valor passado em `global.licenseKey`
  (via `set_sensitive` no Terraform, mascarado nos logs de CI).

### O que foi implementado (issue #164)

- **Biblioteca de log estruturado**: adotado `nestjs-pino` (`pino` +
  `pino-http`) no lugar do log manual (`process.stdout.write`/
  `process.stderr.write` com `JSON.stringify` na mão). Registrado via
  `LoggerModule.forRoot(...)` em `app.module.ts`, com bootstrap em
  `main.ts` (`bufferLogs: true` + `app.useLogger(app.get(Logger))`) — a
  partir daí, o `Logger` padrão do `@nestjs/common` já usado em 13 pontos
  do código (event handlers, guards, stubs) passa a sair formatado como
  JSON via Pino automaticamente, sem precisar editar esses arquivos.
- **Níveis de severidade reais**: o log por requisição HTTP (antes sempre
  `level: 'info'`, mesmo em erro 500) agora mapeia por status code —
  `info` (2xx/3xx), `warn` (4xx), `error` (5xx/exceção). O
  `GlobalExceptionFilter` segue essa mesma régua para exceções não
  tratadas.
- **`GlobalExceptionFilter` migrado para injeção de dependência**: antes
  instanciado manualmente em `main.ts` (`new GlobalExceptionFilter()`),
  agora registrado como provider (`APP_FILTER`) em `app.module.ts`,
  permitindo injetar o logger do Pino. O log interno de cada exceção passa
  a incluir stack trace e tipo do erro (via serializer padrão do Pino),
  nunca expostos na resposta HTTP ao cliente — que continua derivando só
  de `exception.message`.
- **Correlação de requisição via `correlationId`**: contrato mantido
  (header `x-correlation-id` do cliente, validado por regex, ou gerado via
  `randomUUID()`) — agora resolvido uma única vez pelo `pino-http`
  (`genReqId`) e propagado automaticamente para qualquer log emitido
  durante aquela requisição (inclusive dentro do `GlobalExceptionFilter`)
  via `AsyncLocalStorage`, sem precisar repassar o id manualmente.
- **Duas fontes de log HTTP duplicadas/inconsistentes removidas**: o
  `RequestLoggingMiddleware` (substituído pelo `pino-http`) e um bloco de
  middleware solto em `main.ts` que gravava métricas em formato CloudWatch
  EMF — resíduo de uma estratégia nunca adotada (ver "Contexto" acima) que
  gerava seu próprio `correlationId` independente do outro middleware,
  podendo produzir dois ids diferentes para a mesma requisição.
- **New Relic Logs in Context**: habilitado via variáveis de ambiente do
  próprio agente `newrelic` (`NEW_RELIC_APPLICATION_LOGGING_ENABLED=true`,
  `NEW_RELIC_APPLICATION_LOGGING_LOCAL_DECORATING_ENABLED=true`) — decora
  cada linha de log com `trace.id`/`span.id` da transação APM.
  `NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED=false` explicitamente,
  porque o `newrelic-logging` (Fluent Bit) do `repo-k8s-infra` já
  encaminha o stdout dos pods — deixar o agente também encaminhar
  duplicaria a ingestão contra o limite do plano gratuito.

### O que ainda não foi feito

- **Validação end-to-end**: as branches de #163 e #164 existem mas ainda
  não foram aplicadas contra o ambiente real — não há confirmação de que
  telemetria e logs chegam no New Relic, nem de que a correlação
  `trace.id`/log realmente funciona. Critério de aceite explícito das duas
  issues, não deve ser considerado concluído antes de rodar o pipeline de
  verdade.
- **Dashboards** (#166) e **alertas** (#167): não iniciados — não fazem
  sentido antes de #163/#164 estarem validados enviando dado real.

## Alternativas consideradas

Não avaliadas com o mesmo rigor de outras decisões deste projeto — ver
"Contexto" acima. Não há registro de comparação formal contra CloudWatch,
Prometheus/Grafana ou Datadog.

## Consequências positivas

- Um único vendor cobre APM, infraestrutura e logs, evitando integrar e
  manter múltiplas ferramentas separadas (ex.: Prometheus + Grafana +
  Fluent Bit + Jaeger).
- Plano gratuito (100 GB/mês) é folgado para o volume de um projeto
  acadêmico.
- Reaproveita o mesmo mecanismo de infraestrutura como código já usado no
  projeto (Helm via Terraform, secrets do GitHub, Kubernetes Secrets) — sem
  introduzir um novo padrão de gestão de segredos.

## Consequências negativas

- **Footprint mínimo implica visibilidade parcial no início**:
  `nri-metadata-injection` desabilitado significa que, por enquanto, não há
  correlação automática entre uma transação APM e o pod/deployment que a
  processou — precisa ser cruzado manualmente se necessário.
- **Uma license key por conta, compartilhada entre HML e PROD** — sem
  isolamento de dados entre ambientes dentro do New Relic (diferenciados
  apenas pelo nome da aplicação/tag, não por conta separada).
- **Ainda sem tracing distribuído de ponta a ponta** (API Gateway → Lambda
  → EKS → RDS) — o agente cobre a aplicação a partir do EKS, mas correlação
  com a Function Serverless de autenticação não foi avaliada nesta decisão.

## Riscos

- **Médio**: os componentes do `nri-bundle` (DaemonSets/Deployments) somam
  overhead de CPU/memória aos nós do cluster, que já têm histórico de
  ajustes de capacidade por causa da quota de vCPU da conta AWS Academy —
  precisa ser observado após a primeira aplicação real.
- **Baixo**: dependência de uma única conta/license key da New Relic criada
  por uma pessoa do grupo — sem redundância caso o acesso seja perdido.

## Próximos passos

1. Rodar o pipeline (`workflow_dispatch`, ação `plan`, depois `apply`) nos
   repositórios envolvidos e confirmar telemetria e logs reais chegando ao
   New Relic (inclusive a correlação `trace.id`/log) antes de considerar as
   issues #163 e #164 encerradas.
2. Avaliar, com dado real em mãos, se `nri-metadata-injection` e
   `nri-kube-events` valem o custo de recursos adicional.
3. Seguir para dashboards (#166) e alertas (#167).

## Referências

- [`docs/infrastructure/observability.md`](../infrastructure/observability.md)
- [Visão geral da arquitetura](../architecture/overview.md)
- Issue [#162](https://github.com/Async-And-Furious/async-furious-project/issues/162) (epic), [#163](https://github.com/Async-And-Furious/async-furious-project/issues/163) e [#164](https://github.com/Async-And-Furious/async-furious-project/issues/164)
- [Chart `nri-bundle`](https://github.com/newrelic/helm-charts/tree/master/charts/nri-bundle)
- [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino)
