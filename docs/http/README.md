# HTTP collections

Import `postman/async-furious.postman_collection.json` plus either the HML or
PROD environment, or import `insomnia/async-furious.insomnia.json` and select
the matching environment. All credentials, CPF, tokens, endpoint URLs and seed
IDs are variables; populate them from the protected GitHub Environment secrets
and variables. The login requests extract the three staff JWTs, and the
customer request extracts the CPF-auth Lambda JWT.

The protected workflow `protected-route-matrix.yml` runs the same collection's
route contract against the selected environment. It fails on unexpected 401 or
403 and accepts 400 for invalid/state-incompatible mock bodies. DELETE routes
are deliberately reported as skipped because this verification is
non-destructive.
