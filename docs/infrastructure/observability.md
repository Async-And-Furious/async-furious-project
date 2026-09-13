# Observabilidade

> Decisão registrada em [ADR-0005](../adr/0005-observabilidade.md): New
> Relic, implementado em código nas issues #163 (plataforma), #164 (logs
> estruturados) e #165 (monitoramento). Infraestrutura do cluster e logs
> **já validados em HML com dado real** (consulta direta via API da New
> Relic em 2026-09-13); o agente APM da aplicação ainda não — ver
> "Pendências" abaixo.

## Estado atual: infraestrutura e logs validados, APM com bug conhecido

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
- **Validado em HML em 2026-09-13**, consultando a API da New Relic
  (NerdGraph) diretamente: infraestrutura do cluster (`K8sClusterSample`
  para `tc3-eks-hml`, ~11 mil amostras/24h) e logs (`newrelic-logging`,
  ~129 mil linhas/24h, incluindo os logs JSON do `nestjs-pino` do pod da
  aplicação) chegando normalmente.
- **APM da aplicação ainda não confirmado**: zero transações reportadas.
  Causa raiz identificada no log do próprio pod —
  `New Relic failed to open log file /app/newrelic_agent.log` (`EACCES`).
  O `Dockerfile` só copia `node_modules`/`prisma`/`dist`/`dist-scripts` com
  `--chown=nodejs:nodejs` no estágio de produção; o diretório `/app` em si
  continua do `root`, e o container roda como `USER nodejs` — o agente não
  consegue criar o arquivo de log e a inicialização não chega a reportar
  dado. Fix aplicado: `NEW_RELIC_LOG: "stdout"` no ConfigMap
  (`k8s/config/configmap.yaml`), evitando qualquer escrita em disco pelo
  agente. Ainda pendente de validação end-to-end (o deploy de teste
  esbarrou numa falha de infraestrutura não relacionada — ver Pendências).

## O que já existia e foi reaproveitado (sem mudança) — issue #165

- **Health check**: os probes de liveness/readiness/startup do Kubernetes
  (`k8s/app/deployment.yaml`) usam `GET /api/v1/health/live` e
  `GET /api/v1/health/ready` (`HealthController`) — mantidos como estão.
  Métricas de aplicação (latência, throughput, taxa de erro, apdex) já são
  coletadas automaticamente pelo agente APM do #163 assim que ele estiver
  validado; visibilidade de status/restart do pod já vem do
  `newrelic-infrastructure` (#163), sem mudança de código necessária.
- **Sem Synthetic monitor por enquanto (decisão do #165)**: investigado
  expor o health check como um Synthetic/Uptime monitor externo do New
  Relic, mas não existe hoje uma rota pública sem autenticação — o
  roteamento do API Gateway (`repo-auth-serverless/infra/{hml,prod}/main.tf`)
  só expõe `POST /auth` sem auth; todo o resto, incluindo `/health/live` e
  `/health/ready`, passa pelo Lambda Authorizer, e o ALB do cluster é
  interno. Um Synthetic ping simples bateria 401/403, não um sinal de
  saúde real. Considerar no futuro uma rota pública dedicada (`GET
  /health`, sem `authorizer_id`) no API Gateway, especificamente para
  viabilizar um Synthetic monitor — decisão de segurança (abrir endpoint
  sem autenticação) fora do escopo do #165.
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

## Dashboards operacionais (issue #166)

- **Terraform, não UI manual**: recurso `newrelic_one_dashboard` no
  `repo-k8s-infra`, branch `feat/I-166_DashboardsOps` — criada a partir de
  `main` (não `develop`), mesmo motivo do workaround do #163: o
  `nri-bundle` (e agora também este recurso) só existe em `main` até a
  sincronização `develop`↔`main` desse repositório acontecer.
- **Provider novo**: `newrelic/newrelic` (`versions.tf`), com duas
  variáveis novas — `new_relic_account_id` e `new_relic_api_key` — a
  segunda é uma **User API key** (`NRAK-...`), diferente da
  `new_relic_license_key` (uma ingest key) já usada pelo `nri-bundle`.
  Segredo `NEW_RELIC_API_KEY` e variável `NEW_RELIC_ACCOUNT_ID` já criados
  no GitHub do `repo-k8s-infra` em 2026-09-13.
- **Um dashboard por ambiente** (`tc3-observability-${environment}`),
  permissão `public_read_only`, três páginas, reaproveitando 100% dado que
  já vem do #163/#164 (nenhuma instrumentação nova):
  - **Aplicação** (fonte: entidade APM `async-furious-project-${environment}`):
    tempo de resposta médio, throughput, taxa de erro, apdex, top
    endpoints por tempo de resposta.
  - **Infraestrutura** (fonte: `newrelic-infrastructure`, `K8sContainerSample`/
    `K8sNodeSample` filtrados por `clusterName`): CPU e memória por pod,
    contagem de pods/restarts, nós do cluster.
  - **Logs** (fonte: `newrelic-logging`): volume de logs por nível,
    últimos erros — atenção ao nome do atributo: eventos `Log` usam
    `cluster_name` (snake_case), diferente de `clusterName` (camelCase)
    usado pelos samples de infraestrutura — confirmado consultando a API
    da New Relic diretamente em 2026-09-13.
- **Estado**: código escrito e validado localmente (`terraform fmt`,
  `init`, `validate` — todos passando, incluindo o schema do provider
  `newrelic`), **ainda não aplicado** em HML/PROD.

## Alertas operacionais (issue #167)

- **Terraform, mesma branch base do #166** (`feat/I-167_AlertasOps`, a
  partir de `feat/I-166_DashboardsOps`, no `repo-k8s-infra`) — reaproveita
  o provider `newrelic` já configurado ali, sem recurso novo além dos de
  notificação.
- **Uma política por ambiente** (`newrelic_alert_policy`,
  `tc3-observability-${environment}`) com 5 condições NRQL
  (`newrelic_nrql_alert_condition`), todas usando o mesmo `appName`/
  `clusterName` já usados no #166:

  | Condição | Fonte | Limite |
  |---|---|---|
  | App indisponível | `count(*)` em `Transaction` | abaixo de 1 em 5 min |
  | Taxa de erro alta | `percentage(count(*), WHERE error IS true)` em `Transaction` | acima de 5% em 5 min |
  | CPU excessiva | `average(cpuUsedCores/cpuLimitCores)*100` em `K8sContainerSample` | acima de 80% em 10 min |
  | Memória excessiva | `average(memoryWorkingSetBytes/memoryLimitBytes)*100` em `K8sContainerSample` | acima de 80% em 10 min |
  | Pod em crash loop | `sum(restartCount)` em `K8sContainerSample`, facetado por `podName` | acima de 3 restarts em 10 min |

- **Notificação por e-mail**: `newrelic_notification_destination` (tipo
  `EMAIL`) + `newrelic_notification_channel` (tipo `EMAIL`, produto
  `IINT`) + `newrelic_workflow` roteando qualquer issue da política pra
  esse canal — endereço vem da variável `new_relic_alert_email`
  (`NEW_RELIC_ALERT_EMAIL`, já criada no `repo-k8s-infra` em 2026-09-13),
  não hardcoded no `.tf`.
- **Schema do provider verificado localmente** antes de escrever o código
  (`terraform providers schema -json`, contra o `newrelic/newrelic
  v3.97.5` real) — evitou adivinhar nomes de atributo às cegas.
- **Estado**: código escrito e validado (`terraform fmt`/`init`/
  `validate`), **ainda não aplicado** — depende do #166 já estar de pé
  (mesmo `newrelic_alert_policy`/provider), que por sua vez depende da
  validação do #163.

## O que a Fase 3 exige e o estado de cada item

| Requisito | Estado |
|---|---|
| Logs centralizados | **Validado em HML** (`nestjs-pino` + forwarding via Fluent Bit) |
| Níveis de severidade | Implementado em código (`info`/`warn`/`error` por status HTTP), validação de conteúdo real ainda não revisada linha a linha |
| Métricas de aplicação (latência, taxa de erro, throughput) | Bug de permissão identificado e corrigido (`NEW_RELIC_LOG=stdout`); validação end-to-end pendente |
| Métricas de infraestrutura do cluster (CPU/memória por nó) | **Validado em HML** (`newrelic-infrastructure`) |
| Health checks / monitoramento (#165) | Reaproveita probes existentes + #163; sem Synthetic monitor por falta de rota pública (decisão registrada acima) |
| Tracing distribuído (Gateway → Lambda → EKS → RDS) | Agente cobre a aplicação a partir do EKS; correlação com a Function Serverless não avaliada |
| Dashboards | Terraform escrito e validado localmente (issue #166), não aplicado |
| Alertas | Terraform escrito e validado localmente (issue #167), não aplicado |

## Pendências

- Validar o agente APM depois do fix de `NEW_RELIC_LOG=stdout` — confirmar
  a entidade `async-furious-project-hml` reportando transações reais, e
  que a correlação `trace.id`/log ("Logs in Context") funciona na UI do
  New Relic antes de fechar a issue #163.
- Aplicar o Terraform do #166 em HML e confirmar visualmente que os
  widgets carregam dado real antes de fechar a issue.
- Aplicar o Terraform do #167 e testar cada uma das 5 condições de verdade
  (escalar a app pra zero, gerar taxa de erro, estressar CPU/memória de um
  pod, forçar um crash loop) antes de fechar a issue — roteiro já
  documentado no comentário original do #167.
- Reavaliar `nri-metadata-injection`/`nri-kube-events` depois que o APM
  estiver validado e a capacidade dos nós do EKS for confirmada com a carga
  adicional.
- `TODO`: os pontos `[PENDENTE]` em [overview.md](../architecture/overview.md),
  [authentication-flow.md](../architecture/authentication-flow.md) e
  [service-order-flow.md](../architecture/service-order-flow.md) ainda
  descrevem o fluxo sem observabilidade — atualizar depois que a validação
  end-to-end confirmar o comportamento real (fora do escopo desta
  atualização de documentação).
