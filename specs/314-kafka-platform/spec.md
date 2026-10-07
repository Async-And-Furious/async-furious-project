# Issue #314 — application Kafka contract

The application consumes the Kafka platform provisioned by `repo-k8s-infra`.
It must not create brokers or credentials.

- Bootstrap servers and SASL credentials are injected through Kubernetes
  Secret/configuration materialized by the deployment workflow.
- The credential contract is the Secrets Manager secret name
  `tc3/kafka/<environment>` with keys `username` and `password`.
- Topics are `os.events`, `os.events.retry`, and `os.events.dlt`.
- Producers publish domain events to `os.events`; consumers retry transient
  failures through the retry topic and publish exhausted messages to the DLT.
- No local or CI test may require AWS, EKS, Kafka, or a mutation operation.

Runtime smoke tests against HML are pending cluster availability.
