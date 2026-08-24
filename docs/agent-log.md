# Agent log

## 2026-08-24 - Academy runner selection

- Academy deploys now use `ubuntu-latest`; normal deploys retain the
  `[self-hosted, linux, eks-private]` runner labels. Credential handling,
  Service/NLB mode, secret synchronization, and health checks are unchanged.
- No secrets, deployment, commit, or push was run.

## 2026-08-24 - Academy deployment contract

- Academy mode now selects an explicit AWS NLB and materializes only the three
  required application Secret keys from protected AWS references. Missing
  references fail closed; normal mode retains the pre-existing Secret check.
- No secrets, infrastructure apply, merge, or push was run.

## 2026-08-23 - Cross-repository JWT contract

- Consumer contract: RS256 only in production, public-key verification through
  `JWT_PUBLIC_KEY`, issuer `repo-auth-serverless`, audience
  `async-furious-project`, 1800-second expiry, and `sub=Cliente.id`.
- Existing email/password routes remain. CPF authentication stays in the auth
  Lambda; the monolith resolves Lambda subjects to active `Cliente` records by
  id instead of treating CPF/documento as a subject.
- AWS deployment checks now require the public key and exact non-secret JWT
  configuration. No secrets, infrastructure apply, merge, or push was run.
- Follow-up blocker: the legacy monolith email/password token signer still uses
  its local signing secret and is not the Lambda-issued RS256 flow; do not use
  that token for production protected routes until an approved issuer/signing
  ownership decision exists. Lambda/Prisma RDS SSL mode and CA also need the
  deployed RDS policy before adding connection options.

## 2026-08-23 - Release readiness fixes

- Health checks use `/api/v1/health/live`; readiness remains
  `/api/v1/health/ready`. ZAP and E2E no longer probe the root route.
- Local kind uses a loaded local image; EKS deploys an immutable registry
  digest and requires an existing cluster, secrets, ALB controller, database,
  and private runner/AWS access.
- Migration Jobs are unique per commit and workflow attempt and run before
  rollout. Rollback is manual after review:
  `kubectl rollout undo deployment/async-furious-api -n async-furious`.
- HML protected-route smoke tests skip without real endpoint and credentials;
  seed identities and secrets are not logged.
