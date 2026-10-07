# ADR-0019 — Kafka platform contract

The monolith remains a Kafka client; broker lifecycle belongs to
`repo-k8s-infra`. The application receives `KAFKA_BROKERS`, `KAFKA_USERNAME`
and `KAFKA_PASSWORD` from `async-furious-kafka`. Deployment materializes those
values from `tc3/kafka/<environment>` in Secrets Manager and never commits or
prints credentials.

The event, retry and DLT topics are respectively `os.events`,
`os.events.retry` and `os.events.dlt`. HML connectivity smoke validation is a
runtime gate pending cluster availability.
