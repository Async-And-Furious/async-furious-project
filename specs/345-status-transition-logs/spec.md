# #345 — OS status transition logs (partial)

Base: `origin/develop` `f1757162f8bc38b80105c617f833856d32abe704`.

## Scope and boundary

Log transitions observed in selected producers, only when the conditional
repository update confirms this call changed the row:
`IN_PROGRESS -> FINISHED` in `AtualizarStatusFinalizadaHandler`, allowed
pre-repair statuses to `CLOSED_WITHOUT_EXECUTION` in
`AtualizarStatusEncerradaSemExecucaoHandler`, and `AWAITING_APPROVAL ->
CLOSED_WITHOUT_EXECUTION` in `DetectarOsParadaUseCase`. Emit only when
`atualizarSeCondicao` returns true. This is explicitly partial coverage.

`UpdateServiceOrderStatusUseCase` (generic status API/webhook) remains untouched:
it reads then performs unconditional update and cannot safely identify a
winning concurrent transition without changing behavior. No public contract,
event contract, schema, dashboard, or Terraform changes in this OS slice.

## Structured log contract

Use the existing Nest `Logger` / `nestjs-pino` with the formatting/emission
helper in `ordem-servico/application/logging` (no application-to-infrastructure
import) and one fixed JSON object after the conditional update succeeds:

- `logType: "os.status.transition"` (not `event`, which is reserved in existing
  logging conventions)
- `previousStatus`
- `newStatus`

No OS/order ID, customer/vehicle/payment data, `motivo`, raw event, correlation
ID, headers, tokens, or exception text in the serialized record. The helper
explicitly overrides Kafka mixin identity fields with `undefined`; a real Pino
serialization test verifies they are omitted. `service` is already
provided by the existing Pino mixin; `appName` is agent-provided, not set here.
Catch a synchronous logger failure so telemetry cannot interrupt follow-up
history/event work. Existing business failures and retry behavior remain intact.

The separate dashboard draft must filter on `logType =
'os.status.transition'`; do not use `event` for this record.

## Reliability and coverage limits

This is best-effort diagnostic telemetry, not an authoritative ledger. A crash
after the database commit but before logging can lose a record; collector/replay
can duplicate it. The dashboard counts transitions observed in selected async
producers only: generic API/webhook and other uninstrumented async transitions
are absent. Never describe counts as exact totals or
use them for billing/audit/reconciliation. Durable complete accounting would
need a separately approved transactional outbox design.

This is deliberately not representative of all OS transitions: the generic
HTTP status use case does not emit these records. Dashboard titles/labels must
identify the data as partial async telemetry.

## TDD / checks

- Each eligible producer: success emits exactly the fixed object above;
  conditional no-op and update rejection emit no transition object.
- Test logger failure does not alter subsequent history/event behavior.
- Assert object contains only the approved keys/values (no identity, reason,
  correlation, or token); test existing handler retry/idempotency paths remain
  unchanged.
- Run focused tests, Node 22 lint/typecheck/build, and `git diff --check`.
- Dashboard/NRQL, appName inventory, HML ingestion, New Relic query validation,
  and all-transition coverage are outside this increment and unverified.
