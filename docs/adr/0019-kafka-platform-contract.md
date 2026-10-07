# ADR-0019 — Kafka platform contract

The monolith remains a Kafka client; broker lifecycle belongs to
`repo-k8s-infra`. The application receives `KAFKA_BROKERS`, `KAFKA_USERNAME`
and `KAFKA_PASSWORD` from `async-furious-kafka`. Deployment materializes those
values from `tc3/kafka/<environment>` in Secrets Manager and never commits or
prints credentials.

The platform owns `kafka-sasl` in the `kafka` namespace. The application only
materializes its namespaced `async-furious-kafka` runtime projection and never
writes the broker Secret. The event, retry and DLT topics are respectively
`os.eventos.v1`, `os.retry.v1` and `os.dlt.v1`; Billing and execution use
`billing.eventos.v1`, `billing.retry.v1`, `billing.dlt.v1` and
`execucao.eventos.v1`, `execucao.retry.v1`, `execucao.dlt.v1`. HML connectivity
smoke validation is a runtime gate pending cluster availability.
