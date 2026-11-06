# Issue #360 — gateway customer privilege escalation

## Scope

Defensively fix the `AUTH_MODE=gateway` identity mapping so a customer JWT cannot acquire staff authority from its claims, and add staff authorization to the two OS read routes explicitly approved for this issue.

## Current behavior on `develop` (`f1757162`)

- Authentication is performed by `JwtStrategy`: it validates token shape, signature/issuer/audience/expiry and, in gateway mode, currently branches on a missing `role` claim to `AuthService.validateCustomer(sub)`. This is authentication/identity resolution, not route authorization.
- `validateCustomer` checks `Cliente.ativo`, but currently returns `Role.RECEPCIONISTA`. A customer subject therefore authenticates with staff authority; untrusted claims must not select identity or role.
- `validateTokenSubject` already resolves an existing staff `User` first and its database role, then resolves an active `Cliente` as `Role.CLIENTE`; inactive/missing subjects return null. Preserve legitimate staff resolution from the database.
- `RolesGuard` already denies a missing/nonmatching role when `@Roles(...)` metadata exists. It allows a request when no role metadata exists; authentication alone does not imply staff authorization.
- `GET /ordens-servico` and `GET /ordens-servico/:id` currently have no role metadata. They must become staff-only per issue acceptance. `GET /:id/status` and `GET /:id/rastreamento` are explicitly public.
- `PATCH /:id/aprovar-servico` has no method-level role restriction and remains authenticated through the controller's global JWT guard. Do not add staff-role metadata or otherwise change its contract.

## Acceptance criteria (issue #360)

- A gateway JWT with only a valid `sub` for an active customer resolves as `CLIENTE`; absent/inactive customer subjects are unauthorized.
- A gateway customer token with forged staff `role` and/or `email` claims still resolves as that customer (`CLIENTE`), never staff.
- Non-colliding staff subjects resolve using the staff database role; non-colliding active customer subjects resolve as `CLIENTE`.
- If the same subject exists in both `User` and `Cliente`, authentication fails with 401 regardless of customer active status. Do not let any JWT claim choose which record wins.
- Identity lookup database errors fail closed as 401; do not log subject IDs, email, CPF, or database error details.
- `RolesGuard` continues denying `CLIENTE` for staff roles (including `RECEPCIONISTA`, `ADMIN`, and `MECANICO`).
- `GET /ordens-servico` and `GET /ordens-servico/:id` require `ADMIN`, `RECEPCIONISTA`, or `MECANICO`; authorized staff retain access and customers are denied. Public status/tracking routes stay public.
- `PATCH /ordens-servico/:id/aprovar-servico` remains JWT-authenticated without a new role restriction.
- Do not alter JWT/API contracts, route paths, DTOs, response shapes, database schema, or migration state.
- Unit coverage for identity resolution and role authorization, plus gateway and local HTTP tests for customer/staff/inactive subjects, approval, identity collisions and lookup failures, cover the above. Follow repo convention: new controller tests under `test/`; use isolated mocked Prisma identity seams, not the shared DB.
- HML confirmation with a real Lambda-issued token is external evidence and remains **unverified** unless actually performed with approval and access. This phase must not invoke AWS.

## TDD plan / evidence

1. Review and adapt existing tests first: `src/auth/auth.service.spec.ts` (`validateCustomer`, `validateTokenSubject`), `src/auth/strategies/jwt.strategy.spec.ts`, `src/auth/guards/roles.guard.spec.ts`; add/update only assertions required by acceptance.
2. Add/update `test/ordem-servico-role-access.spec.ts` against actual controller metadata for list/detail, public status/tracking, and approval method. Test expected authorization distinctions, not handler/business behavior.
3. Adapt the prior isolated gateway harness (`test/gateway-auth-http.e2e-spec.ts` on prior work) to current Nest setup: gateway config before app bootstrap, real Passport/JWT strategy and guards/controllers, ephemeral signing keys, mocked Prisma identity lookup. Assert customer 403 at staff routes, valid staff access, and unchanged authenticated approval behavior; avoid shared DB and real credentials.
4. Evidence for HML, if separately authorized: record deployment/version, token issuer/claim _shape only_ (never token/CPF), route, status codes, and timestamp. A prior issue comment reports a 2026-10-27 HML reproduction (customer token reached validation on `POST /clientes`, observed 400 instead of expected 403); it does not constitute post-fix verification.

## Risks / constraints

- Main risk is breaking staff login/token behavior while ignoring customer-controlled role/email claims. Resolve identity from trusted database records; preserve non-colliding staff roles and active customer identity.
- Adding role metadata changes authorization behavior on two existing routes but not their API shape. It prevents broad OS reads by customer identities; do not add ownership filtering or redesign customer OS access in this issue.
- Approval is JWT-only today; preserve that behavior even though its summary says customer approval. Do not infer authorization policy from prose or change public/private status.
- Prior implementation work exists in closed PR #362 (`fix/issue-360-client-role`) and in the separate worktree `issue-360-completion`, whose base is 36 commits behind current `develop`. Treat its tests/spec as reference only; rebase concepts against current code, inspect for stale assumptions, and do not touch that worktree.
- Collision policy is fail-closed by explicit user decision: a `sub` present in both `User` and `Cliente` is unauthorized even if the customer is inactive. This avoids escalation but leaves identity-data cleanup and any future collision resolution policy open; do not log sensitive subject data.
