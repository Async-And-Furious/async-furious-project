# Design de Infraestrutura Terraform + Kubernetes

**Data:** 2026-06-22  
**Status:** Aprovado  
**Escopo:** Provisionamento de IaC via Terraform (cluster kind local) + manifests Kubernetes para o async-furious-project

---

## Contexto

API NestJS + PostgreSQL já containerizados via Docker/docker-compose. Objetivo: provisionar um ambiente Kubernetes reproduzível localmente (kind) via Terraform, com um caminho de migração claro para o EKS.

---

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| K8s local | kind | Roda em Docker, zero pré-requisitos extras, compatível com CI |
| Estado do Terraform | `.tfstate` local | Projeto acadêmico, sem necessidade de backend remoto por enquanto |
| CI/CD Terraform | apenas validate + plan | Sem auto-apply; humanos executam `terraform apply` |
| Estrutura do Terraform | Modular (B) | YAML do K8s reutilizável fora do Terraform; migração para EKS = novo diretório de ambiente |
| Formato dos manifests K8s | YAML puro em `/k8s` | Legível, compatível com kubectl para debug |

---

## Estrutura de Diretórios

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
      README.md   (stub — não implementado)
```

---

## Providers do Terraform

| Provider | Versão | Finalidade |
|---|---|---|
| `tehcyx/kind` | ~> 0.4 | Provisionar cluster kind |
| `gavinbunney/kubectl` | ~> 1.14 | Aplicar manifests YAML puros |
| `hashicorp/kubernetes` | ~> 2.0 | Ler kubeconfig a partir do output do kind |

---

## Módulo: `kind-cluster`

**Entradas:**
- `cluster_name` (string) — padrão `"async-furious"`
- `kubernetes_version` (string) — padrão `"v1.29.0"`
- `node_port` (number) — padrão `30000` (mapeia host:30000 → container:30000)

**Saídas:**
- `kubeconfig` (string sensível) — repassado ao módulo `kubernetes-apps`

**Comportamento:** Cria 1 control-plane + 1 worker node. Configura extraPortMappings para acesso via NodePort.

---

## Módulo: `kubernetes-apps`

**Entradas:**
- `kubeconfig` (string sensível)
- `app_image` (string)
- `app_replicas` (number)
- `db_name` (string)
- `db_password` (string sensível)
- `jwt_secret` (string sensível)

**Comportamento:**
- Conecta ao cluster via kubeconfig
- Aplica os recursos YAML em ordem via `kubectl_manifest`:
  1. `namespace.yaml`
  2. `config/configmap.yaml`, `config/secret.yaml`
  3. `database/statefulset.yaml`, `database/service.yaml`, `database/pvc.yaml`
  4. `app/deployment.yaml`, `app/service.yaml`, `app/hpa.yaml`
- Valores sensíveis injetados via `templatefile()` — não hardcoded no YAML

---

## Recursos Kubernetes

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
- Imagem: `async-furious-api:latest` (carregada no kind via `kind load docker-image`)
- Réplicas: 2
- Recursos: requests `cpu:100m mem:128Mi` / limits `cpu:500m mem:512Mi`
- Readiness probe: HTTP GET `/health` porta 3000, delay inicial de 10s
- Liveness probe: HTTP GET `/health` porta 3000, delay inicial de 30s
- Variáveis de ambiente vindas de referências ao ConfigMap + Secret

### App Service (`/k8s/app/service.yaml`)
- Tipo: `NodePort`
- Porta 3000 → nodePort 30000 (acesso local em `localhost:30000`)
- Observação: para o EKS, alterar para `LoadBalancer` ou usar Ingress

### HPA (`/k8s/app/hpa.yaml`)
- Réplicas mínimas: 2 / Máximas: 5
- Scale up quando CPU > 70% ou Memória > 80%

### Database StatefulSet (`/k8s/database/statefulset.yaml`)
- Imagem: `postgres:15-alpine`
- Monta o PVC em `/var/lib/postgresql/data`
- Variáveis de ambiente vindas de referências ao ConfigMap + Secret

### Database Service (`/k8s/database/service.yaml`)
- Tipo: `ClusterIP` (apenas interno)
- Porta 5432

### PVC (`/k8s/database/pvc.yaml`)
- Armazenamento: 1Gi
- AccessMode: ReadWriteOnce

---

## `terraform.tfvars` (versionado, não sensível)

```hcl
cluster_name  = "async-furious"
app_image     = "async-furious-api:latest"
app_replicas  = 2
db_name       = "workshop"
db_user       = "postgres"
```

## Variáveis sensíveis (NÃO versionadas, passadas via env)

```bash
export TF_VAR_jwt_secret="..."
export TF_VAR_db_password="..."
```

---

## CI/CD: `.github/workflows/terraform.yml`

**Gatilho:** PR que altere `infra/**` ou `k8s/**`

**Etapas:**
1. `terraform init` (environments/local)
2. `terraform validate`
3. `terraform plan -out=tfplan`
4. Upload do plan como artefato do PR

Sem `terraform apply` no CI. Nenhum secret de nuvem é necessário para validate+plan.

---

## Fluxo de Trabalho do Desenvolvedor Local

```bash
# 1. Build e carregamento da imagem no kind
docker build -t async-furious-api:latest .
kind load docker-image async-furious-api:latest --name async-furious

# 2. Provisionamento
cd infra/environments/local
export TF_VAR_jwt_secret="dev-secret"
export TF_VAR_db_password="postgres"
terraform init
terraform apply

# 3. Acesso
curl http://localhost:30000/health

# 4. Desprovisionamento
terraform destroy
```

---

## Caminho de Migração para o EKS

1. Adicionar `infra/environments/aws/main.tf` usando o provider `aws` + `terraform-aws-modules/eks`
2. Enviar a imagem para o ECR, atualizar a variável `app_image`
3. Alterar o tipo do App Service para `LoadBalancer` (ou adicionar Ingress + controller ALB)
4. Adicionar backend S3 para estado remoto
5. Manifests do K8s em `/k8s` permanecem inalterados

---

## Mapeamento dos Critérios de Aceite

| Critério | Implementação |
|---|---|
| Estrutura `/infra` | `infra/environments/local/` + módulos |
| Configuração de provider | `infra/versions.tf` + providers dos módulos |
| Cluster K8s via Terraform | `modules/kind-cluster` |
| PostgreSQL via Terraform | `modules/kubernetes-apps` → StatefulSet do DB |
| Recursos K8s via Terraform | `modules/kubernetes-apps` → todos os manifests |
| ConfigMaps | `/k8s/config/configmap.yaml` |
| Secrets | `/k8s/config/secret.yaml` (valores vindos de variáveis do TF) |
| HPA | `/k8s/app/hpa.yaml` |
| Variáveis reutilizáveis | `terraform.tfvars` + `variables.tf` |
| Outputs | `outputs.tf` (kubeconfig, endpoint do cluster, URL da app) |
| Compatível com CI/CD | `.github/workflows/terraform.yml` |
| Local + nuvem | kind local agora, stub de ambiente EKS |
| Documentação | Esta spec + atualizações do README |
