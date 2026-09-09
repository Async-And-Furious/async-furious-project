# ADR-0005: Estratégia de observabilidade

## Status

Aceita — decisão de ferramenta tomada (New Relic), instrumentação e
integração de infraestrutura implementadas em código na issue
[#163](https://github.com/Async-And-Furious/async-furious-project/issues/163).
**Pendente**: validação end-to-end (telemetria chegando de fato no New
Relic) e dashboards/alertas (issues #166/#167), ainda não iniciados.

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

### O que ainda não foi feito

- **Validação end-to-end**: as branches acima existem mas ainda não foram
  aplicadas contra o ambiente real — não há confirmação de que a telemetria
  chega no New Relic. Isso é um critério de aceite explícito da issue #163
  e não deve ser considerado concluído antes de rodar o pipeline de verdade.
- **Logs estruturados de aplicação** (issue #164): existe hoje um
  `RequestLoggingMiddleware` (JSON estruturado, `correlationId` por
  requisição) cobrindo logs de request HTTP, mas não logs de
  aplicação/domínio em geral.
- **Dashboards** (#166) e **alertas** (#167): não iniciados — não fazem
  sentido antes de #163 estar validado enviando dado real.

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
   dois repositórios e confirmar telemetria real chegando ao New Relic
   antes de considerar a issue #163 encerrada.
2. Avaliar, com dado real em mãos, se `nri-metadata-injection` e
   `nri-kube-events` valem o custo de recursos adicional.
3. Seguir para logs de aplicação (#164), dashboards (#166) e alertas
   (#167).

## Referências

- [`docs/infrastructure/observability.md`](../infrastructure/observability.md)
- [Visão geral da arquitetura](../architecture/overview.md)
- Issue [#162](https://github.com/Async-And-Furious/async-furious-project/issues/162) (epic) e [#163](https://github.com/Async-And-Furious/async-furious-project/issues/163)
- [Chart `nri-bundle`](https://github.com/newrelic/helm-charts/tree/master/charts/nri-bundle)
