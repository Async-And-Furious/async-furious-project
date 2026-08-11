# Observabilidade

> Decisão (inexistente) registrada em [ADR-0005](../adr/0005-observabilidade.md).
> Este documento existe para deixar o gap explícito, conforme exigido pela
> tarefa de auditoria — **não é uma proposta de ferramenta**.

## Estado atual: nenhum

Evidência de ausência, reunida por busca em todo o repositório e checagem de
dependências:

```
grep -rniE "prometheus|grafana|opentelemetry|\botel\b|datadog|new relic|
  newrelic|winston|pino|cloudwatch|correlation.?id|trace.?id|apm\b"
  src/ k8s/ infra/ docs/ .github/
# 0 resultados
```

- `package.json`: nenhuma dependência de logging estruturado
  (`winston`/`pino`), métricas (`prom-client`), tracing
  (`@opentelemetry/*`) ou APM (`newrelic`, `datadog`, `sentry`).
- `src/main.ts`: usa apenas o comportamento padrão do NestJS, sem logger
  customizado.
- Nenhum manifest em `k8s/` provisiona um agente de coleta de logs/métricas
  (Fluent Bit, OpenTelemetry Collector, CloudWatch Agent).
- Nenhuma RFC, ADR ou branch remota (incluindo as três branches de RFC não
  mescladas) menciona observabilidade.

## O que já existe e pode ser reaproveitado (sem decisão nova)

- **Health check**: `GET /api/v1` já é usado pelos probes de liveness e
  readiness do Kubernetes (`k8s/app/deployment.yaml`) — é o único sinal de
  saúde hoje, consumido apenas pelo próprio Kubernetes, não exportado para
  fora do cluster.
- **HPA**: já reage a CPU/memória via `metrics-server`
  (`k8s/app/hpa.yaml`), mas sem visibilidade de latência ou taxa de erro de
  negócio.

## O que a Fase 3 exige e ainda não tem

| Requisito | Estado |
|---|---|
| Logs centralizados | Ausente |
| Métricas de aplicação (latência, taxa de erro, throughput) | Ausente |
| Tracing distribuído (Gateway → Lambda → EKS → RDS) | Ausente |
| Dashboards | Ausente |
| Alertas | Ausente |

## Pendências

- `TODO`: nenhuma ferramenta deve ser escolhida por esta auditoria sem
  decisão do grupo — ver ADR-0005 para o porquê de não inventar uma escolha
  aqui.
- `TODO`: quando uma ferramenta for decidida, os pontos `[PENDENTE]` já
  marcados em [overview.md](../architecture/overview.md),
  [authentication-flow.md](../architecture/authentication-flow.md) e
  [service-order-flow.md](../architecture/service-order-flow.md) devem ser
  atualizados com o fluxo real.
