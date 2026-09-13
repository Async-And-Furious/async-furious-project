# Authenticated route matrix

## Contract

`docs/http/routes.yaml` is the canonical manifest. It contains one entry per
`METHOD + path`, with explicit `auth`, `role`, `allowed_status`, `mutating`,
and `mock_body` policy. The matrix and both generated HTTP collections consume
this file recursively, including future nested `routes` groups. The current
contract has 48 unique routes.

Authentication policies are separate:

- `customer` and `staff` use JWT `Authorization: Bearer ...` headers.
- `webhook` uses only `X-Webhook-Secret`; it must never receive a JWT header.
- The webhook secret is printed only as a truncated SHA-256 fingerprint.

Mocks use the all-zero UUID for resource references and do not delete data.
DELETE entries are reported as skipped. Registration uses the stable invalid
domain address in the manifest and accepts `201` on first use or `409` when it
already exists, making reruns idempotent without creating unbounded users.

## Validation

```sh
python scripts/generate-http-collections.py
python scripts/route-matrix.py
pnpm run type:check
pnpm run test -- --runInBand
```

The protected `protected-route-matrix.yml` workflow runs the same checks for a
selected HML or PROD GitHub Environment. It does not deploy or apply
infrastructure.
