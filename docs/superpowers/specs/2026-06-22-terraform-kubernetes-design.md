# Terraform + Kubernetes Infrastructure Design

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** IaC provisioning via Terraform (local kind cluster) + Kubernetes manifests for async-furious-project

---

## Context

NestJS API + PostgreSQL already containerized via Docker/docker-compose. Goal: provision a reproducible Kubernetes environment locally (kind) via Terraform, with a clear migration path to EKS.

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Local K8s | kind | Runs in Docker, zero extra prereqs, CI-compatible |
| Terraform state | Local `.tfstate` | Academic project, no remote backend needed now |
| CI/CD Terraform | validate + plan only | No auto-apply; humans run `terraform apply` |
| Terraform structure | Modular (B) | K8s YAML reusable outside Terraform; EKS migration = new env dir |
| K8s manifest format | Raw YAML in `/k8s` | Readable, kubectl-compatible for debugging |

---

## Directory Structure

```
/k8s
  namespace.yaml
  /config
    configmap.yaml
    secret.yaml
  /app
    deployment.yaml
    service.yaml
    hpa.yaml
  /database
    statefulset.yaml
    service.yaml
    pvc.yaml

/infra
  versions.tf
  /modules
    /kind-cluster
      main.tf
      variables.tf
      outputs.tf
    /kubernetes-apps
      main.tf
      variables.tf
      outputs.tf
  /environments
    /local
      main.tf
      variables.tf
      outputs.tf
      terraform.tfvars
    /aws
      README.md   (stub — not implemented)
```

---

## Terraform Providers

| Provider | Version | Purpose |
|---|---|---|
| `tehcyx/kind` | ~> 0.4 | Provision kind cluster |
| `gavinbunney/kubectl` | ~> 1.14 | Apply raw YAML manifests |
| `hashicorp/kubernetes` | ~> 2.0 | Read kubeconfig from kind output |

---

## Module: `kind-cluster`

**Inputs:**
- `cluster_name` (string) — default `"async-furious"`
- `kubernetes_version` (string) — default `"v1.29.0"`
- `node_port` (number) — default `30000` (maps host:30000 → container:30000)

**Outputs:**
- `kubeconfig` (sensitive string) — passed to `kubernetes-apps` module

**Behavior:** Creates 1 control-plane + 1 worker node. Configures extraPortMappings for NodePort access.

---

## Module: `kubernetes-apps`

**Inputs:**
- `kubeconfig` (sensitive string)
- `app_image` (string)
- `app_replicas` (number)
- `db_name` (string)
- `db_password` (sensitive string)
- `jwt_secret` (sensitive string)

**Behavior:**
- Connects to cluster via kubeconfig
- Applies YAML resources in order via `kubectl_manifest`:
  1. `namespace.yaml`
  2. `config/configmap.yaml`, `config/secret.yaml`
  3. `database/statefulset.yaml`, `database/service.yaml`, `database/pvc.yaml`
  4. `app/deployment.yaml`, `app/service.yaml`, `app/hpa.yaml`
- Secret values injected via `templatefile()` — not hardcoded in YAML

---

## Kubernetes Resources

### Namespace
```
name: async-furious
```

### ConfigMap (`/k8s/config/configmap.yaml`)
```
NODE_ENV: production
PORT: "3000"
DB_HOST: postgres-service
DB_NAME: workshop
DB_PORT: "5432"
DB_USER: postgres
```

### Secret (`/k8s/config/secret.yaml`)
```
JWT_SECRET: <from TF_VAR_jwt_secret>
POSTGRES_PASSWORD: <from TF_VAR_db_password>
```

### App Deployment (`/k8s/app/deployment.yaml`)
- Image: `async-furious-api:latest` (loaded into kind via `kind load docker-image`)
- Replicas: 2
- Resources: requests `cpu:100m mem:128Mi` / limits `cpu:500m mem:512Mi`
- Readiness probe: HTTP GET `/health` port 3000, initial delay 10s
- Liveness probe: HTTP GET `/health` port 3000, initial delay 30s
- Env from ConfigMap + Secret refs

### App Service (`/k8s/app/service.yaml`)
- Type: `NodePort`
- Port 3000 → nodePort 30000 (local access at `localhost:30000`)
- Note: for EKS, change to `LoadBalancer` or use Ingress

### HPA (`/k8s/app/hpa.yaml`)
- Min replicas: 2 / Max: 5
- Scale up at CPU > 70% or Memory > 80%

### Database StatefulSet (`/k8s/database/statefulset.yaml`)
- Image: `postgres:15-alpine`
- Mounts PVC at `/var/lib/postgresql/data`
- Env from ConfigMap + Secret refs

### Database Service (`/k8s/database/service.yaml`)
- Type: `ClusterIP` (internal only)
- Port 5432

### PVC (`/k8s/database/pvc.yaml`)
- Storage: 1Gi
- AccessMode: ReadWriteOnce

---

## `terraform.tfvars` (committed, non-sensitive)

```hcl
cluster_name  = "async-furious"
app_image     = "async-furious-api:latest"
app_replicas  = 2
db_name       = "workshop"
db_user       = "postgres"
```

## Sensitive vars (NOT committed, passed via env)

```bash
export TF_VAR_jwt_secret="..."
export TF_VAR_db_password="..."
```

---

## CI/CD: `.github/workflows/terraform.yml`

**Trigger:** PR touching `infra/**` or `k8s/**`

**Steps:**
1. `terraform init` (environments/local)
2. `terraform validate`
3. `terraform plan -out=tfplan`
4. Upload plan as PR artifact

No `terraform apply` in CI. No cloud secrets needed for validate+plan.

---

## Local Developer Workflow

```bash
# 1. Build and load image into kind
docker build -t async-furious-api:latest .
kind load docker-image async-furious-api:latest --name async-furious

# 2. Provision
cd infra/environments/local
export TF_VAR_jwt_secret="dev-secret"
export TF_VAR_db_password="postgres"
terraform init
terraform apply

# 3. Access
curl http://localhost:30000/health

# 4. Teardown
terraform destroy
```

---

## EKS Migration Path

1. Add `infra/environments/aws/main.tf` using `aws` provider + `terraform-aws-modules/eks`
2. Push image to ECR, update `app_image` variable
3. Change App Service type to `LoadBalancer` (or add Ingress + ALB controller)
4. Add S3 backend for remote state
5. K8s manifests in `/k8s` unchanged

---

## Acceptance Criteria Mapping

| Criterion | Implementation |
|---|---|
| `/infra` structure | `infra/environments/local/` + modules |
| Provider config | `infra/versions.tf` + module providers |
| K8s cluster via Terraform | `modules/kind-cluster` |
| PostgreSQL via Terraform | `modules/kubernetes-apps` → DB StatefulSet |
| K8s resources via Terraform | `modules/kubernetes-apps` → all manifests |
| ConfigMaps | `/k8s/config/configmap.yaml` |
| Secrets | `/k8s/config/secret.yaml` (values from TF vars) |
| HPA | `/k8s/app/hpa.yaml` |
| Reusable variables | `terraform.tfvars` + `variables.tf` |
| Outputs | `outputs.tf` (kubeconfig, cluster endpoint, app URL) |
| CI/CD compatible | `.github/workflows/terraform.yml` |
| Local + cloud | kind local now, EKS env stub |
| Documentation | This spec + README updates |
