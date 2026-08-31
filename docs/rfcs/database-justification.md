# Justificativa formal do banco de dados

- **Status**: Accepted
- **Date**: 2026-07-29
- **Resolves**: HANDOFF.md §20, decision #6 ("Banco definitivo e versão")
- **Source of truth**: this file, in `async-furious-project`. Copy exists in
  `repo-db-infra` for local visibility — update here first, then sync.

## Decision

**Amazon RDS for PostgreSQL 16**, provisioned via `repo-db-infra`
(`modules/rds`).

## Context

The engine was never actually open — the application already uses
PostgreSQL exclusively via Prisma (`datasource db { provider = "postgresql" }`
in `async-furious-project/prisma/schema.prisma`). The only real gap was an
unresolved **version** mismatch across environments:

- CI (`tests.yml`, `zap.yml`): `postgres:16`
- Local dev (`docker-compose.dependencies.yml`): `postgres:15-alpine`
- RDS: undecided

## Rationale

- Switching engines (e.g. to MySQL) would mean rewriting the Prisma schema,
  every migration, and re-validating all existing business logic against a
  different SQL dialect — no justification exists for that cost.
- PostgreSQL 16 was already the CI target; aligning local dev and RDS to it
  removes a latent bug where code could pass locally against 15 and behave
  differently in CI/prod against 16 (extension availability, planner
  behavior, deprecated syntax).
- RDS PostgreSQL is a fully managed engine on AWS, satisfying the "banco
  gerenciado" requirement (§3.1/§3.4) directly, with built-in automated
  backups, encryption at rest, and Multi-AZ failover for prod.

## Consequences

- `docker-compose.dependencies.yml` updated to `postgres:16-alpine` to match
  CI and RDS.
- `repo-db-infra/modules/rds` provisions `aws_db_instance` with
  `engine = "postgres"`, `engine_version = "16.4"`, `auto_minor_version_upgrade = true`
  (patch versions are allowed to drift automatically; major version 16 is
  pinned).
- hml: `multi_az = false`, `skip_final_snapshot = true`, 1-day backup
  retention (cheap, disposable).
- prod: `multi_az = true`, `deletion_protection = true`, 7-day backup
  retention.
- Master password uses RDS-managed master user password
  (`manage_master_user_password = true`): AWS generates and stores it in
  Secrets Manager directly, never in Terraform state or a CI secret. The
  Lambda's DB client reads it from Secrets Manager at runtime — how it
  authenticates to fetch that secret (IAM role vs. static ARN reference)
  is deferred to RFC-006 (secrets strategy), still open.
