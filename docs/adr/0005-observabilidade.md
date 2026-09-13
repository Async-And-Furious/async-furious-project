# ADR-0005: Estratégia de observabilidade

## Status

Proposta — **sem ferramenta, sem decisão registrada, sem implementação**.
Este ADR documenta um requisito em aberto, não uma decisão tomada.

## Contexto

A Fase 3 exige observabilidade (logs, métricas, tracing) como parte da
arquitetura distribuída. A auditoria que originou este documento buscou por
qualquer evidência de observabilidade em todo o repositório e nos três
repositórios satélite:

- Busca por `prometheus|grafana|opentelemetry|otel|datadog|newrelic|winston|pino|cloudwatch`
  em `src/`, `k8s/`, `infra/`, `docs/`, `.github/`: **zero resultados**.
- `package.json`: nenhuma dependência de logging estruturado, métricas ou
  tracing (`winston`, `pino`, `@nestjs/terminus`, `prom-client`,
  `opentelemetry`, `newrelic`, `datadog`, `sentry` — todas ausentes).
- `src/main.ts`: nenhum `Logger` estruturado além do padrão do NestJS.
- Nenhuma RFC ou ADR (nem nas branches remotas não mescladas) menciona
  observabilidade.
- Nenhum dos manifests `k8s/` ou módulos Terraform provisiona um agente de
  coleta (ex.: Fluent Bit, OpenTelemetry Collector, CloudWatch Agent).

## Decisão

**Nenhuma.** Não há decisão de ferramenta ou estratégia a registrar — este
documento existe para deixar essa ausência explícita e rastreável, em vez de
omiti-la.

## Alternativas consideradas

Não avaliadas — não há registro de nenhuma discussão sobre CloudWatch,
Prometheus/Grafana, OpenTelemetry, Datadog ou qualquer outra ferramenta em
nenhuma fonte encontrada nesta auditoria.

## Consequências positivas

Nenhuma — nada foi decidido ainda.

## Consequências negativas

- Todos os fluxos documentados nesta auditoria
  ([overview.md](../architecture/overview.md),
  [authentication-flow.md](../architecture/authentication-flow.md),
  [service-order-flow.md](../architecture/service-order-flow.md)) têm um
  passo final de observabilidade marcado `[PENDENTE]` — nenhum log,
  métrica ou trace é de fato emitido para uma ferramenta centralizada hoje.
- Sem tracing distribuído, depurar uma requisição que atravessa API
  Gateway → Function Serverless → EKS → RDS (fluxo proposto) exigiria
  correlacionar logs manualmente em pelo menos 4 lugares diferentes (AWS
  Console do API Gateway, logs de Lambda, logs de pods, RDS).

## Riscos

- **Alto**: a proposta Fase 3 aumenta o número de saltos de rede (Gateway →
  Lambda → ALB → EKS → RDS) exatamente no momento em que não há nenhuma
  observabilidade — o sistema fica estruturalmente mais difícil de debugar
  assim que a proposta for implantada, se este gap não for endereçado antes.
- **Médio**: sem métricas, o HPA (`k8s/app/hpa.yaml`) já implementado
  depende só de CPU/memória via `metrics-server` — não há visibilidade de
  latência ou taxa de erro para validar se o auto-scaling está de fato
  respondendo à demanda real do negócio.

## Próximos passos recomendados (não decisões)

1. Abrir uma RFC dedicada de observabilidade quando o grupo decidir uma
   ferramenta — este ADR não deve ser usado como base para escolher uma
   tecnologia por conta própria, pois não há requisito específico
   confirmado (ex.: orçamento de custo, ferramenta já usada em outra
   disciplina do curso).
2. No mínimo, health checks (`GET /api/v1`, já usados pelos probes do
   Kubernetes) poderiam alimentar um dashboard básico sem exigir uma nova
   ferramenta — mas isso também não foi decidido, apenas listado como opção
   de baixo custo.

## Referências

- [`docs/infrastructure/observability.md`](../infrastructure/observability.md)
- [Visão geral da arquitetura](../architecture/overview.md)
