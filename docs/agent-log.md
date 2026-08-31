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
