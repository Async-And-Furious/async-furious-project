# Observabilidade

> Decisão registrada em [ADR-0005](../adr/0005-observabilidade.md): New
> Relic, implementado em código nas issues #163 (plataforma) e #164 (logs
> estruturados), **pendente de validação end-to-end** — este documento
> reflete o que existe no código das branches
> `feat/I-163_EstruturarPlataformaObservabilidade` (`repo-k8s-infra`) e
> `feat/I-164_ImplementarLogsEstruturados` (`async-furious-project`, a
> partir da branch do #163), não uma confirmação de que já está rodando em
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
- **Logs estruturados da aplicação** (`async-furious-project`, issue
  #164): `nestjs-pino` substitui o log JSON manual de antes — registrado
  via `LoggerModule.forRoot(...)` em `app.module.ts`, com bootstrap em
  `main.ts`. Níveis de severidade reais por status HTTP (`info`/`warn`/
  `error`, antes sempre `info`), `GlobalExceptionFilter` migrado para DI
  para logar exceções com stack trace via o mesmo logger, e as variáveis
  `NEW_RELIC_APPLICATION_LOGGING_*` habilitando a decoração automática de
  cada linha de log com `trace.id`/`span.id` da transação APM ("Logs in
  Context").
- **Nenhuma das branches foi aplicada contra o ambiente real ainda** —
  falta rodar o pipeline (`workflow_dispatch`, `plan` e depois `apply`) e
  confirmar telemetria e logs chegando ao New Relic.

## O que já existia e foi reaproveitado (sem mudança)

- **Health check**: `GET /api/v1` continua sendo o sinal de saúde usado
  pelos probes de liveness/readiness do Kubernetes
  (`k8s/app/deployment.yaml`) — ainda não exportado como uptime check para
  o New Relic (candidato natural para a issue #165).
- **HPA**: continua reagindo a CPU/memória via `metrics-server`
  (`k8s/app/hpa.yaml`) — o `newrelic-infrastructure` passa a dar
  visibilidade sobre esses mesmos números fora do cluster, mas o HPA em si
  não foi alterado.
- **Contrato de `correlationId`**: o header `x-correlation-id` (aceito do
  cliente se em formato válido, gerado via `randomUUID()` caso contrário,
  sempre ecoado na resposta) já existia antes da #164 — o que mudou foi
  onde ele é resolvido (`pino-http`, via `genReqId`, em vez de um
  middleware manual) e sua propagação automática para qualquer log emitido
  durante a requisição.

## O que a Fase 3 exige e o estado de cada item

| Requisito | Estado |
|---|---|
| Logs centralizados | Implementado em código (`nestjs-pino` + forwarding via Fluent Bit), não validado |
| Níveis de severidade | Implementado em código (`info`/`warn`/`error` por status HTTP), não validado |
| Métricas de aplicação (latência, taxa de erro, throughput) | Implementado em código (agente APM), não validado |
| Métricas de infraestrutura do cluster (CPU/memória por nó) | Implementado em código (`newrelic-infrastructure`), não validado |
| Tracing distribuído (Gateway → Lambda → EKS → RDS) | Agente cobre a aplicação a partir do EKS; correlação com a Function Serverless não avaliada |
| Dashboards | Não iniciado (issue #166) |
| Alertas | Não iniciado (issue #167) |

## Pendências

- Rodar o pipeline de verdade (`plan` e `apply`) nos repositórios
  envolvidos e confirmar telemetria e logs chegando ao New Relic antes de
  fechar as issues #163 e #164 — inclusive validar que a correlação
  `trace.id`/log ("Logs in Context") realmente funciona na UI do New
  Relic, não só que os dados chegam.
- Reavaliar `nri-metadata-injection`/`nri-kube-events` depois que o básico
  estiver validado e a capacidade dos nós do EKS for confirmada com a carga
  adicional.
- `TODO`: os pontos `[PENDENTE]` em [overview.md](../architecture/overview.md),
  [authentication-flow.md](../architecture/authentication-flow.md) e
  [service-order-flow.md](../architecture/service-order-flow.md) ainda
  descrevem o fluxo sem observabilidade — atualizar depois que a validação
  end-to-end confirmar o comportamento real (fora do escopo desta
  atualização de documentação).
