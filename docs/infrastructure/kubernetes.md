# Kubernetes

> Decisão registrada em [ADR-0003](../adr/0003-kubernetes-eks-orquestracao.md).
> Este documento cobre **como** o cluster é operado hoje e a proposta de
> nuvem — não repete o racional da decisão.

## [ATUAL] Ambiente local (`kind`)

Evidência: `k8s/*.yaml`, `infra/modules/kind-cluster/`,
`infra/modules/kubernetes-apps/`.

| Manifesto | Kind | Detalhe confirmado |
|---|---|---|
| `k8s/namespace.yaml` | Namespace | `async-furious` |
| `k8s/config/configmap.yaml` | ConfigMap | `NODE_ENV`, `PORT`, `DB_HOST=postgres-service`, `DB_NAME=workshop`, `DB_PORT`, `DB_USER` |
| `k8s/config/secret.yaml` | Secret (Opaque) | `JWT_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — injetados via `templatefile()` do Terraform, nunca hardcoded no YAML |
| `k8s/app/deployment.yaml` | Deployment | `async-furious-api`; initContainers `migrate` (`prisma migrate deploy`) e `seed`; probes de liveness/readiness em `GET /api/v1` (não `/health`); requests `cpu:100m/mem:128Mi`, limits `cpu:500m/mem:512Mi` |
| `k8s/app/service.yaml` | Service | `NodePort`, `3000 → 30000` |
| `k8s/app/hpa.yaml` | HorizontalPodAutoscaler | min 2 / max 5 réplicas; CPU > 70% ou memória > 80% |
| `k8s/database/statefulset.yaml` | StatefulSet | `postgres:15-alpine`, 1 réplica |
| `k8s/database/service.yaml` | Service | `ClusterIP`, porta 5432 |
| `k8s/database/pvc.yaml` | PersistentVolumeClaim | 1Gi, `ReadWriteOnce` |

`imagePullPolicy: Never` — a imagem é construída localmente e carregada nos
nós via `kind load docker-image` (necessário sempre que o código muda; ver
`scripts/local-up.sh reload`). Não há registry neste ambiente.

**`metrics-server`** é instalado automaticamente pelo módulo Terraform
`kubernetes-apps` — pré-requisito para o HPA funcionar.

Nenhum `Ingress` está configurado neste ambiente (acesso via `NodePort`
diretamente). Nenhuma `NetworkPolicy` foi encontrada.

## [PROPOSTA FASE 3] Ambiente de nuvem (EKS via `repo-k8s-infra`)

Evidência: árvore de arquivos de `repo-k8s-infra`
(`modules/vpc/main.tf`, `modules/eks/main.tf`, `modules/ecr/main.tf`,
`environments/{hml,prod}/backend.tf`) — **conteúdo dos módulos não lido em
profundidade nesta auditoria** (fora do escopo de acesso direto ao código
deste repositório satélite); apenas a existência e os nomes dos arquivos
foram confirmados via `gh api`.

- **VPC**: provisionada e possuída por `repo-k8s-infra`
  ([ADR-0001](../adr/0001-separacao-quatro-repositorios.md),
  RFC-004 (trigo)) — subnets públicas/privadas,
  rotas/NAT.
- **EKS**: cluster gerenciado, consumido por `repo-auth-serverless` (via ALB
  interno) para expor a aplicação.
- **ECR**: registry de imagens — módulo presente (`modules/ecr`), mas
  "opcional" segundo o próprio README do repositório; `TODO` confirmar se
  será de fato usado ou se a estratégia de imagem para EKS ficará em
  aberto.
- **Convenção de nomes**: `tc3-{recurso}-{ambiente}` (ex.: `tc3-eks-hml`),
  conforme README de `repo-k8s-infra`.
- **Status**: "Skeleton only. No `terraform apply` has been run." (README de
  `repo-k8s-infra`, verbatim) — **nada disto está de fato provisionado**.

## Reaproveitamento de manifests

A estrutura modular do Terraform (decidida em
`docs/superpowers/specs/2026-06-22-terraform-kubernetes-design.md`) existe
justamente para que os manifests YAML de `/k8s` deste repositório sejam
reaproveitados sem alteração na migração para EKS — apenas o `Service` do
tipo `NodePort` precisaria virar `LoadBalancer`/`Ingress`
(já anotado como nota no próprio manifest local, `k8s/app/service.yaml`).

## Pendências

- `TODO`: conteúdo real dos módulos `modules/eks`, `modules/vpc` de
  `repo-k8s-infra` não foi auditado linha a linha (apenas existência dos
  arquivos, via listagem de árvore do GitHub).
- `TODO`: nenhuma `NetworkPolicy`, `PodSecurityStandard` ou `ResourceQuota`
  encontrada em nenhum dos dois ambientes.
