# RFC-006: Secrets strategy and JWT signing

## Status

Accepted — 2026-07-30

**Source of truth**: this file. A copy exists in `repo-auth-serverless`
for local visibility since it implements this RFC — update here first,
then sync.

## Context

HANDOFF.md decision list (§20) leaves three related items open:

- #2 — Lambda Authorizer vs. native JWT authorizer.
- #7 — JWT signature: symmetric vs. asymmetric.
- #8 — token duration and claims.

`repo-auth-serverless`'s two Lambda handlers (`authenticate-customer`,
`authorize-request`) are still `501`/`isAuthorized: false` stubs pending
this decision. `repo-db-infra`'s RDS module also deferred "how the Lambda
authenticates to read secrets at runtime" to this RFC.

This also has to account for the same forward-looking constraint as
RFC-003: the monolith in `repo-application` will eventually split into
microservices, and any future service will need to verify JWTs issued by
`repo-auth-serverless` independently.

## Decision

**Authorizer: custom Lambda Authorizer**, not API Gateway's native JWT
authorizer. Native JWT authorizer requires a public JWKS HTTPS endpoint
for the issuer — extra standing infrastructure with no other use in this
project. A Lambda Authorizer also matches the two-handler layout HANDOFF
§4.3 already suggests (`authenticate-customer` / `authorize-request`) and
keeps full control over custom claim validation.

**Signature: RS256 (asymmetric)**, not HS256. Rationale:

- The private key never leaves `repo-auth-serverless`. Only its two
  Lambdas get `secretsmanager:GetSecretValue` on the one secret holding
  it.
- The public key is not sensitive. It goes in SSM Parameter Store as a
  plain `String` (not `SecureString`), so any verifier — today's
  `authorize-request` Lambda, tomorrow's `repo-application` doing its own
  independent claim verification, or a future microservice — only ever
  needs read access to a non-secret parameter. No cross-repo secret
  sharing, no IAM grants on the actual signing key outside
  `repo-auth-serverless`.
- With HS256 every verifier needs the same shared secret, which gets
  harder to scope correctly as more services need to verify tokens.

**Token**: 30 minute expiry, minimal claims — `sub` (customer id), `iat`,
`exp`, `iss` (`repo-auth-serverless`). No raw CPF in the payload.

## Key storage

- Private key: AWS Secrets Manager, one secret, referenced by ARN via a
  Lambda environment variable (never the key material itself).
- Public key: SSM Parameter Store, one `String` parameter, referenced by
  name via a Lambda environment variable.
- Both are provisioned once out-of-band (generated via `openssl`, stored
  by whoever has IAM access) — not generated or committed by application
  code or Terraform state.

## Consequences

- `authorize-request` fetches the public key from SSM and verifies
  RS256 signatures — no dependency on `repo-db-infra` or any other repo.
- `authenticate-customer`'s JWT *issuance* step (once implemented) fetches
  the private key from Secrets Manager and signs with RS256.
- The CPF-validation-against-customer-record part of
  `authenticate-customer` is explicitly out of scope for this RFC — it
  depends on HANDOFF.md decision #11 (Lambda direct-to-RDS vs. RDS Proxy)
  and the customer data contract, both still open.
- Resolves HANDOFF.md decisions #2, #7, #8.

## Alternatives considered

- **HS256 + Lambda Authorizer**: simpler (one secret, no keypair), but
  every future verifier needs the same shared secret — worse fit for the
  microservices direction.
- **Native JWT authorizer (RS256 + JWKS endpoint)**: avoids writing
  authorizer code, but requires standing up and maintaining a public JWKS
  endpoint for no other benefit at this scale.
