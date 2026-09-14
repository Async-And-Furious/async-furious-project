# ADR-0002: Centralized authentication via API Gateway + Function Serverless

## Status

**Accepted and partially implemented.** RFC-003 and RFC-006 are accepted.
`repo-auth-serverless` ships both Lambda handlers (`authenticate-customer`,
`authorize-request`) with CI/CD, Terraform, and CloudWatch alarms — no longer
skeletons. On the application side, PR #182
(`feat/customer-jwt-rs256-auth`) added the consumer: `JwtCustomerStrategy`
(RS256) and `JwtCustomerAuthGuard`, plus `Role.CLIENTE`. Staff authentication
(`ADMIN`/`RECEPCIONISTA`/`MECANICO`) intentionally remains local — see
"Decision on staff roles" below.

## Context

Before this change, authentication and authorization (JWT + bcrypt, roles
`ADMIN`/`RECEPCIONISTA`/`MECANICO`) ran entirely inside the NestJS process
(`src/auth/`). Phase 3 requires a single entry point (API Gateway) with
centralized authentication before a request reaches any application in the
Kubernetes cluster — including support for more than one service behind the
same Gateway in the future.

## Decision

Extract customer authentication to its own repository and process
(`repo-auth-serverless`), fronted by an API Gateway (HTTP API):

- **Token issuance**: the `authenticate-customer` Function Serverless
  validates the CPF and issues a JWT signed with **RS256**.
- **Token validation**: the `authorize-request` Function Serverless, acting
  as a **custom Lambda Authorizer** (not the API Gateway's native JWT
  authorizer), validates the signature and claims on every protected route.
- **Secrets**: the private key lives in AWS Secrets Manager (only the two
  `repo-auth-serverless` Lambdas can access it); the public key lives in SSM
  Parameter Store (non-sensitive, any future verifier can read it without
  access to the private key).
- **Application integration**: API Gateway → VPC Link → internal ALB
  (managed by `repo-k8s-infra` via Kubernetes Ingress) → application pods on
  EKS. The application additionally re-verifies the RS256 signature,
  issuer, and audience in-process via `JwtCustomerStrategy`, rather than
  trusting the Lambda Authorizer's decision alone.

## Decision on staff roles

`repo-auth-serverless` only authenticates customers by CPF; there is no
Lambda or Gateway route for staff (`ADMIN`/`RECEPCIONISTA`/`MECANICO`).
PR #182 explicitly scoped the migration to the customer/CPF flow only:
staff login and registration (`AuthService`, `JwtStrategy`, HS256,
`JWT_SECRET`) remain local for now. This is a recorded decision, not an
oversight — migrating staff auth to an external service is a separate,
not-yet-scoped follow-up (it would require either a staff-facing Lambda or a
different centralization strategy).

## Alternatives considered

(Recorded in RFC-006)

- **API Gateway's native JWT authorizer**: rejected — it would require
  exposing a public JWKS endpoint, permanent infrastructure with no other use
  in the project.
- **HS256 (symmetric signing)**: rejected — every future verifier would need
  the same shared secret, a worse fit for a microservices direction.
- **REST API + NLB** (instead of HTTP API + VPC Link + ALB, recorded in
  RFC-003): rejected — more expensive, and NLB is L4-only, requiring new
  target-group wiring per future microservice.

## Positive consequences

- Customer authentication is isolated from business code — the NestJS
  application no longer implements token issuance logic for the end
  customer.
- The private key never leaves `repo-auth-serverless`; any future verifier
  (the application itself, or a future microservice) only needs the
  non-sensitive public key.
- ALB/Ingress (instead of NLB) allows adding path/host routing for future
  microservices without touching the Gateway or the VPC Link.

## Negative consequences

- New distributed failure point: unavailability of the Function Serverless
  blocks all customer authentication (see the alternate flow in
  [authentication-flow.md](../architecture/authentication-flow.md)).
- Two authentication implementations coexist today: `src/auth/` (local,
  JWT+bcrypt, staff users) and `repo-auth-serverless` (RS256, end customer by
  CPF) — by decision (see above), not by omission.

## Risks

- **Medium**: `authenticate-customer` decided to query the RDS instance
  directly rather than via RDS Proxy (see RFC-006).
- **Low**: no route in the application is protected by `Role.CLIENTE` yet;
  the consumer-side infrastructure (strategy + guard + role) is ready, but no
  business use case currently requires customer self-service, so this is
  expected rather than a gap.

## References

- RFC-003 (API Gateway/EKS) and RFC-006 (secrets/JWT) — see
  [`docs/rfcs/README.md`](../rfcs/README.md)
- [Authentication sequence](../architecture/authentication-flow.md)
- `src/auth/` (current local staff implementation, `async-furious-project`)
- PR #182 (`feat/customer-jwt-rs256-auth`) — consumer-side implementation
- `repo-auth-serverless` — issuer-side implementation
