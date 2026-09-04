# Agent Log

## 2026-08-30

- Integrated monolith-side HML/PROD gateway mode: RS256 verification, local HS256 email/password fallback, correlation IDs, JSON request/error telemetry, and live/readiness checks.
- Protected the service-order webhook with a constant-time shared-secret guard.
- Removed AWS Kubernetes dependence on in-cluster PostgreSQL. HML/PROD consume `DATABASE_URL` from the protected RDS contract; local-only Terraform may enable its PostgreSQL resources explicitly.
- Kept controlled Prisma migrations, made HML seed automatic, and gated production seed behind workflow dispatch plus `seed_prod=true`.
- Kept immutable commit-SHA image publishing, protected production Environment approval, Academy temporary credentials for both logical environments, and endpoint /32 save/restore logic.
- Validation: `pnpm exec jest --runInBand` passed 709 tests; `pnpm run build` passed; `pnpm run lint` passed with existing warnings; Terraform validation could not complete because required providers are not installed locally.
- Added AWS Load Balancer Controller TargetGroupBinding, explicit RDS secret connection fields, strict gateway JWT claims/customer subject validation, and PROD EKS endpoint access save/restore. Removed automatic Terraform destroy from CI; local teardown remains manual.

## 2026-08-31

- Added backward-safe `Cliente.ativo` migration with default-true backfill; gateway JWT customer validation now accepts Auth Lambda `sub=Cliente.id` only for active customers.
- Added CloudWatch Embedded Metric Format request metrics and JSON alarm events without a new dependency.

## 2026-09-04

- Updated HML/PROD EKS deploys to read the Auth public key from the
  `JWT_PUBLIC_KEY_PARAMETER_NAME` SSM parameter contract, with decryption and
  line-by-line masking; no AWS changes were applied.

## 2026-08-24 - Academy deployment follow-up

- Academy deploys use hosted runners and Service LoadBalancer mode without ALB/IRSA; normal deployment behavior remains unchanged.
- Secret synchronization fails closed when required AWS references are missing, and no secrets, deployment, commit, or push was run during this follow-up.
