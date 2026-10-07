# Issue #333 — Independent CI pipeline

## Goal

Make the OS Service independently verifiable and deploy-safe from a clean
checkout, without requiring HML or production access.

## Scope

- Pin the supported runtime to Node.js 22 in the version file, package
  metadata, container images, and GitHub Actions.
- Make CI run dependency installation, Prisma generation, unit tests with a
  measurable coverage threshold, lint, typecheck, and build.
- Keep deployment orchestration explicit and guarded: local/CI validation must
  never apply shared or production infrastructure implicitly.
- Add a SonarQube quality-gate seam when Sonar configuration is present,
  without making local development depend on Sonar credentials.
- Document the independent pipeline and the deployment guard in an ADR.

## Acceptance criteria

1. A clean Node.js 22 checkout can run tests, lint, typecheck, and build using
   the repository's package manager.
2. CI fails when coverage is below the configured 75% minimum threshold and
   publishes the coverage report.
3. CI validates deploy-related configuration without running Terraform apply,
   Kubernetes apply, or production deployment.
4. Sonar analysis is opt-in and its quality gate is enforced only when the
   configured Sonar workflow/secrets are available.
5. Documentation states the local commands, CI stages, and explicit approval
   boundary for deploy/apply operations.

## Out of scope

- HML/prod credentials, AWS resources, migrations against shared databases,
  and any remote deployment.
- Changes to public application APIs or domain behavior.
