# #345 — OS terminal status transition logs (code-path coverage)

Base: `origin/develop` `f1757162f8bc38b80105c617f833856d32abe704`.

## Scope and boundary

Log code paths that persist either terminal OS status:

- `FINISHED`: `AtualizarStatusFinalizadaHandler` after its conditional update,
  and `UpdateServiceOrderStatusUseCase` after repository update.
- `CLOSED_WITHOUT_EXECUTION`: `AtualizarStatusEncerradaSemExecucaoHandler`
  after its conditional update, `DetectarOsParadaUseCase` after its conditional
  update, and `UpdateServiceOrderStatusUseCase` after repository update.

The generic use case is reached by `ServiceOrderStatusWebhookController`; the
same webhook is reachable through its documented caller. Refusal transitions
also reach the selected handler from `PATCH :id/orcamento/recusar`, the public
approval-decision route when the decision is refusal, and Billing Kafka
`OrcamentoRecusado` / `PagamentoRecusado` events. `ExecucaoConcluida` reaches the
finish handler; the detector publishes its compensation before its CAS.

Do not change the generic route's current read-then-unconditional-update
concurrency behavior. Its `previousStatus` is the status observed before the
update and can be stale under concurrent writes; the conditional producers log
only after winning the CAS. No schema or public contract change.

## Structured log contract

Use the formatting/emission helper in `ordem-servico/application/logging` (no
application-to-infrastructure import) and an independent Pino logger after the
repository update succeeds. It shares the configured `SERVICE_NAME` and
`os-service` fallback with the HTTP logger and does not inherit HTTP/Kafka
bindings. Emit one fixed JSON object:

- `logType: "os.status.transition"` (not `event`, which is reserved in existing
  logging conventions)
- `previousStatus`
- `newStatus`

No OS/order ID, customer/vehicle/payment data, `motivo`, raw event, correlation
ID, headers, tokens, or exception text in the serialized record. This also
protects the refusal handler when called from an HTTP request. `appName` is
agent-provided, not set here.
Catch a synchronous logger failure so telemetry cannot interrupt follow-up
history/event work. Existing business failures and retry behavior remain intact.

The separate dashboard draft must filter on `logType =
'os.status.transition'`; do not use `event` for this record.

## Reliability and coverage limits

This is best-effort diagnostic telemetry, not an authoritative ledger. A crash
after the database commit but before logging can lose a record; collector/replay
can duplicate it. The dashboard counts observations from current application
code paths, not exact committed transition totals; concurrent generic updates
can also produce duplicate observations and a stale `previousStatus`. Direct database writes and future paths
are not covered. Never describe counts as exact totals or
use them for billing/audit/reconciliation. Durable complete accounting would
need a separately approved transactional outbox design.

Dashboard titles/labels must identify the data as partial, best-effort
observations, not complete Saga coverage or an authoritative ledger.

## TDD / checks

- Each terminal code path: successful persisted update emits the fixed object;
  conditional no-op and update rejection emit no transition object.
- Test logger failure does not alter subsequent history/event behavior.
- Nest wiring tests extract real logger and producer providers from module
  metadata with external dependencies stubbed; not a full bootstrap.
- Assert object contains only the approved keys/values (no identity, reason,
  correlation, or token); test existing handler retry/idempotency paths remain
  unchanged.
- Run focused tests, Node 22 lint/typecheck/build, and `git diff --check`.
- Dashboard/NRQL, appName inventory, HML ingestion, New Relic query validation,
  and all-transition coverage are outside this increment and unverified.
