# Observabilidade

> Decisão registrada em [ADR-0005](../adr/0005-observabilidade.md): New
> Relic, implementado em código na issue #163, **pendente de validação
> end-to-end** — este documento reflete o que existe no código das branches
> `feat/I-163_EstruturarPlataformaObservabilidade` (`async-furious-project`
> e `repo-k8s-infra`), não uma confirmação de que já está rodando em
> produção.

## Estado atual: implementado em código, não validado

- **APM da aplicação** (`async-furious-project`): agente `newrelic`
  instrumentando `src/main.ts`, configurado 100% via variável de ambiente
  (`NEW_RELIC_NO_CONFIG_FILE=true`, `NEW_RELIC_APP_NAME`,
  `NEW_RELIC_LICENSE_KEY`). Nome da aplicação difere por ambiente
  (`async-furious-project-hml` / `-prod`).
- **Infraestrutura do cluster** (`repo-k8s-infra`): Helm chart `nri-bundle`
  (versão `8.0.24`) aplicado via `helm_release` no Terraform, com
  `newrelic-infrastructure`, `newrelic-logging` e `kube-state-metrics`
  habilitados; `nri-metadata-injection`, `nri-kube-events`,
  `newrelic-prometheus-agent` e Pixie desabilitados (footprint mínimo,
  ver ADR-0005 para o porquê).
- **Segredos**: `NEW_RELIC_LICENSE_KEY` como secret do GitHub em ambos os
  repositórios, nunca commitado — materializado como Kubernetes Secret via
  `kubectl create secret` (app) e via o próprio chart (`global.licenseKey`
  com `set_sensitive` no Terraform).
- **Nenhuma das duas branches foi aplicada contra o ambiente real ainda** —
  falta rodar o pipeline (`workflow_dispatch`, `plan` e depois `apply`) e
  confirmar telemetria chegando ao New Relic.

## O que já existia e foi reaproveitado (sem mudança)

- **Health check**: `GET /api/v1` continua sendo o sinal de saúde usado
  pelos probes de liveness/readiness do Kubernetes
  (`k8s/app/deployment.yaml`) — ainda não exportado como uptime check para
  o New Relic (candidato natural para a issue #165).
- **HPA**: continua reagindo a CPU/memória via `metrics-server`
  (`k8s/app/hpa.yaml`) — o `newrelic-infrastructure` passa a dar
  visibilidade sobre esses mesmos números fora do cluster, mas o HPA em si
  não foi alterado.
- **Logs de request HTTP**: o `RequestLoggingMiddleware`
  (`src/shared/infrastructure/http/request-logging.middleware.ts`) já
  gerava logs JSON estruturados com `correlationId` por requisição antes
  desta issue — o que mudou agora é que o `newrelic-logging` (Fluent Bit)
  passa a encaminhar esse stdout para o New Relic. Logs de
  aplicação/domínio fora do escopo HTTP ainda não são estruturados (issue
  #164).

## O que a Fase 3 exige e o estado de cada item

| Requisito | Estado |
|---|---|
| Logs centralizados | Implementado em código (forwarding), não validado |
| Métricas de aplicação (latência, taxa de erro, throughput) | Implementado em código (agente APM), não validado |
| Métricas de infraestrutura do cluster (CPU/memória por nó) | Implementado em código (`newrelic-infrastructure`), não validado |
| Tracing distribuído (Gateway → Lambda → EKS → RDS) | Agente cobre a aplicação a partir do EKS; correlação com a Function Serverless não avaliada |
| Dashboards | Não iniciado (issue #166) |
| Alertas | Não iniciado (issue #167) |

## Pendências

- Rodar o pipeline de verdade (`plan` e `apply`) nos dois repositórios e
  confirmar telemetria chegando ao New Relic antes de fechar a issue #163.
- Reavaliar `nri-metadata-injection`/`nri-kube-events` depois que o básico
  estiver validado e a capacidade dos nós do EKS for confirmada com a carga
  adicional.
- `TODO`: os pontos `[PENDENTE]` em [overview.md](../architecture/overview.md),
  [authentication-flow.md](../architecture/authentication-flow.md) e
  [service-order-flow.md](../architecture/service-order-flow.md) ainda
  descrevem o fluxo sem observabilidade — atualizar depois que a validação
  end-to-end confirmar o comportamento real (fora do escopo desta
  atualização de documentação).
