# Observabilidade

> [ADR-0005](../adr/0005-observabilidade.md) registrou a ausência de decisão
> sobre ferramenta de observabilidade. Isso continua valendo: não há stack
> escolhida. O que mudou é que a infraestrutura AWS trouxe sinais nativos que
> antes não existiam, e este documento os registra em vez de repetir que não
> há nada.

## 1. O que existe hoje

### Logs estruturados

As três camadas emitem JSON de uma linha por evento, para stdout, com
correlation ID.

| Origem | Evento | Campos |
|---|---|---|
| Aplicação (`RequestLoggingMiddleware`) | `http_request` | `correlationId`, `method`, `path`, `statusCode`, `durationMs` |
| Lambda de autenticação | `authenticate_customer_succeeded` / `_rejected` | `correlation_id`, `duration_ms` |
| Lambda authorizer | `authorizer_allowed` / `authorizer_denied` | `correlation_id`, `reason`, `duration_ms` |

O correlation ID atravessa a cadeia inteira. O cliente pode fornecê-lo em
`x-correlation-id`; o authorizer valida ou gera um, o API Gateway o reescreve
no header antes de chamar o backend, e o middleware da aplicação aceita o valor
recebido quando ele bate no padrão `^[a-zA-Z0-9._:-]{1,128}$`, gerando um novo
caso contrário. O valor volta ao cliente no header da resposta.

Nenhum dos três registra CPF, token ou credencial.

Os logs das Lambdas vão para CloudWatch Logs, em grupos com retenção de 30
dias. Os logs da aplicação ficam no stdout dos pods, coletados apenas pelo
`kubectl logs`: não há agente de coleta no cluster.

### Health checks

A aplicação expõe três endpoints públicos: `GET /api/v1/health`,
`/health/live` e `/health/ready`. O Kubernetes usa `live` para liveness e
startup, `ready` para readiness. O `ready` é o único que faz verificação real
de dependência.

### Alarmes CloudWatch

Sete alarmes provisionados por Terraform, todos criados sem `alarm_actions`.

| Origem | Alarme | Limiar |
|---|---|---|
| `repo-db-infra` | CPU da instância RDS | 80% |
| `repo-db-infra` | Armazenamento livre | 2 GiB |
| `repo-db-infra` | Conexões abertas | 80 |
| `repo-auth-serverless` | Erros da Lambda de autenticação | métrica `Errors` |
| `repo-auth-serverless` | Erros da Lambda authorizer | métrica `Errors` |
| `repo-auth-serverless` | `5XXError` na rota `/auth` | métrica do HTTP API |
| `repo-auth-serverless` | `5XXError` na rota protegida | métrica do HTTP API |

### Métricas de infraestrutura

`metrics-server` alimenta o HPA com CPU e memória por pod. É a única métrica
que produz ação automática hoje. CloudWatch coleta as métricas nativas de RDS,
Lambda, API Gateway e ALB sem configuração adicional.

### Verificação sintética

`smoke-hml` e `smoke-prod` no `deploy-eks.yml` checam, a cada deploy, se o
target group tem alvo saudável e se o gateway rejeita requisição sem token.
É uma verificação pontual, não contínua.

## 2. O que continua faltando

| Requisito | Estado |
|---|---|
| Logs centralizados da aplicação | Ausente. Sem Fluent Bit, CloudWatch Agent ou OpenTelemetry Collector no cluster |
| Destino de notificação dos alarmes | Ausente. Os sete alarmes disparam para o vazio |
| Métricas de aplicação (latência por rota, taxa de erro de negócio) | Ausente. `durationMs` existe no log, mas não vira métrica |
| Tracing distribuído | Ausente. O correlation ID permite correlacionar manualmente, mas não há X-Ray nem OTel |
| Dashboards | Ausente |
| Monitoramento sintético contínuo | Ausente. Só o smoke test por deploy |

## 3. Pendências

- Anexar destinos aos alarmes existentes. Os módulos já aceitam
  `alarm_actions` e `alarm_ok_actions` como variáveis; falta decidir o destino
  (SNS, e-mail, chat) e passar os ARNs. É a menor distância entre o estado
  atual e alerta funcionando.
- Decidir a coleta de logs da aplicação. Enquanto não houver agente, o log de
  um pod morto se perde.
- ADR-0005 continua sem decisão de stack. As lacunas da tabela acima não devem
  ser preenchidas por escolha unilateral.
- Os pontos marcados `[PENDENTE]` em
  [overview.md](../architecture/overview.md),
  [authentication-flow.md](../architecture/authentication-flow.md) e
  [service-order-flow.md](../architecture/service-order-flow.md) precisam ser
  revistos: parte deles já é coberta pelos sinais nativos descritos aqui.
