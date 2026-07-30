# RFC-004 — Ownership da VPC e outputs

- **Status**: Accepted
- **Date**: 2026-07-29
- **Source of truth**: this file, in `async-furious-project`. Copies exist in
  `repo-k8s-infra` and `repo-db-infra` for local visibility — update here
  first, then sync.

## Context

HANDOFF.md §6.1 suggested `repo-k8s-infra` as VPC owner but left it
unconfirmed. The Tech Challenge Fase 3 requires two separate Terraform
repos — one for Kubernetes infra, one for the managed database — and a
database has to sit inside some VPC/subnet, so exactly one of the two must
own the network.

## Decision

`repo-k8s-infra` owns the VPC, public/private subnets, and route
tables/NAT. `repo-db-infra` does not create a VPC; it consumes `vpc_id` and
`private_subnet_ids` as Terraform input variables from `repo-k8s-infra`'s
outputs.

## Rationale

- The challenge's own repo split (§3.2) requires two independent infra
  repos; one owning network is the only way to avoid two competing VPCs.
- `repo-db-infra`'s `variables.tf` was already scaffolded to take
  `vpc_id`/`private_subnet_ids` as inputs — this decision formalizes the
  existing shape rather than changing it.
- No requirement in the challenge restricts cross-repo Terraform output
  consumption; each repo still owns its own Terraform state, CI/CD, and
  apply pipeline independently (§3.7).

## Consequences

- `repo-k8s-infra` outputs `vpc_id`, `private_subnet_ids`,
  `public_subnet_ids`, `cluster_name`, `ecr_repository_url` (per HANDOFF.md
  §5.2) for downstream repos to consume.
- `repo-db-infra` must be applied after `repo-k8s-infra` (provisioning
  order per HANDOFF.md §6.4: network before database).
- Output values are passed via a `terraform_remote_state` data source in
  `repo-db-infra` pointed at `repo-k8s-infra`'s S3 state key
  (`repo-k8s-infra/${environment}/terraform.tfstate`, same bucket both
  repos use for their own state). `vpc_id`/`private_subnet_ids` still
  accept manual overrides; `allowed_security_group_ids` always includes
  the EKS node group SG plus any extras. This only resolves once
  `repo-k8s-infra`'s state has actually been applied for that environment
  — the provisioning-order requirement above is load-bearing, not just
  a suggestion.
