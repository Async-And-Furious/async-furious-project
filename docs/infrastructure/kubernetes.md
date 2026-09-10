# Kubernetes

> Decisão registrada em [ADR-0003](../adr/0003-kubernetes-eks-orquestracao.md).
> Este documento cobre **como** os clusters são operados, não o racional da
> decisão. Os dois ambientes estão implementados: `kind` na máquina do
> desenvolvedor e no CI, EKS em `hml` e `prod`.
>
> Para os recursos AWS que sustentam o cluster gerenciado, ver
> [aws.md](./aws.md).

## 1. Manifests compartilhados

Os mesmos arquivos em `k8s/` servem aos dois ambientes. Três deles têm
placeholders resolvidos em tempo de aplicação, por `templatefile()` no
Terraform local e por `sed` no pipeline AWS.

| Manifesto | Tipo | Detalhe | Placeholders |
|---|---|---|---|
| `k8s/namespace.yaml` | Namespace | `async-furious` | |
| `k8s/config/configmap.yaml` | ConfigMap | `NODE_ENV`, `PORT`, `AUTH_MODE`, `DEPLOY_ENV`, contrato JWT, `DB_NAME`, `DB_USER` | |
| `k8s/config/secret.yaml` | Secret | `DATABASE_URL`, credenciais, `JWT_SECRET`, `JWT_PUBLIC_KEY`, `WEBHOOK_SECRET`, senhas de seed | 15 valores |
| `k8s/app/deployment.yaml` | Deployment | `async-furious-api`, `automountServiceAccountToken: false`, requests `100m`/`128Mi`, limits `500m`/`512Mi`, mais limites de `ephemeral-storage` | `app_image`, `app_replicas` |
| `k8s/app/service.yaml` | Service | `ClusterIP`, `3000` | |
| `k8s/app/hpa.yaml` | HPA | min 2, max 5; CPU 70% ou memória 80% | |
| `k8s/app/migration-job.yaml` | Job | `prisma migrate deploy`, `backoffLimit: 3`, `ttlSecondsAfterFinished: 86400` | `app_image` |
| `k8s/app/target-group-binding.yaml` | TargetGroupBinding | registra os pods no target group do ALB | `target_group_arn` |
| `k8s/database/*` | StatefulSet, Service, PVC | Postgres `15-alpine`, 1Gi | |

O Deployment tem três probes, todas em endpoints dedicados de saúde:
`readinessProbe` em `/api/v1/health/ready`, `livenessProbe` e `startupProbe`
em `/api/v1/health/live`. A `startupProbe` dá até 150 segundos de partida
(30 tentativas a cada 5 segundos) antes de a liveness começar a matar o pod.

A migração deixou de ser `initContainer` e virou um Job próprio, aplicado uma
vez por deploy em vez de uma vez por pod.

## 2. Ambiente local (`kind`)

Provisionado por Terraform: `infra/environments/local` compõe os módulos
`kind-cluster` e `kubernetes-apps`, este último aplicando os manifests com o
provider `gavinbunney/kubectl`.

- Cluster `async-furious`, Kubernetes `v1.29.0`, `node_port` 30000.
- Imagem `async-furious-api:local`, construída localmente e carregada com
  `kind load docker-image`. O `imagePullPolicy` é `IfNotPresent`, então a
  imagem precisa ser recarregada a cada mudança de código
  (`scripts/local-up.sh reload`).
- Banco no próprio cluster, via StatefulSet Postgres `15-alpine`, ligado pela
  variável `enable_local_database`. Com ela desligada, o módulo aceita uma
  `database_url` externa.
- `metrics-server` `v0.7.2` é aplicado pelo módulo `kubernetes-apps`, com
  `--kubelet-insecure-tls`, porque o HPA não funciona sem ele.
- Acesso pela aplicação: `kubectl port-forward svc/async-furious-service
  30000:3000` (`scripts/local-up.sh`), não pelo NodePort.
- Segredos vêm de variáveis `TF_VAR_*`, exigidas pelo script antes do apply.
  Nenhum valor sensível está nos YAML versionados
  ([ADR-0015](../adr/0015-segredos-kubernetes-templatefile.md)).

`scripts/orchestrate-stack.ps1` cobre o mesmo ciclo no Windows.

## 3. Ambiente AWS (EKS)

Cluster `tc3-eks-<env>` provisionado por `repo-k8s-infra`. A aplicação não
provisiona cluster: ela publica imagem e aplica manifests em um cluster que já
existe.

O que muda em relação ao local:

| Aspecto | Local (`kind`) | AWS (EKS) |
|---|---|---|
| Imagem | `async-furious-api:local`, carregada no nó | ECR, referenciada por digest imutável |
| Banco | StatefulSet no cluster | RDS fora do cluster |
| Exposição | `port-forward` | TargetGroupBinding, ALB interno, API Gateway |
| Migração | não aplicada por nenhum recurso versionado (ver Pendências) | Job dedicado, executado pelo pipeline |
| `AUTH_MODE` | `local` | `gateway` |
| Réplicas | 2 fixas | 2, com HPA até 5 |

### Registro no balanceador

Não há Ingress em uso. O ALB e o target group são criados por
`repo-k8s-infra`, e a aplicação apenas se registra neles através do CRD
`TargetGroupBinding`, do AWS Load Balancer Controller, com `targetType: ip`. O
pipeline substitui `${target_group_arn}` pelo ARN lido do estado Terraform de
`repo-k8s-infra`, deleta o binding anterior e aplica o novo
(`.github/workflows/deploy-eks.yml:378-389`).

A escolha evita que a aplicação crie um balanceador próprio: o ciclo de vida do
ALB pertence a quem é dono da rede.

### Sequência de um deploy

1. Endpoint público do cluster é aberto temporariamente para o IP do runner,
   com máscara `/32`, e o valor original é guardado para restauração.
2. `namespace.yaml` e `configmap.yaml` são aplicados; o ConfigMap recebe um
   `kubectl patch` com `AUTH_MODE=gateway`, `DEPLOY_ENV` e o contrato JWT.
3. O Secret é montado em tempo de execução a partir do Secrets Manager e
   aplicado por `kubectl create ... --dry-run=client | kubectl apply -f -`.
4. Em HML, o node group é escalado para 3 nós e o Deployment é zerado para
   liberar capacidade para o Job de migração.
5. O Job de migração roda e é aguardado.
6. Deployment, Service, TargetGroupBinding e HPA são aplicados; o pipeline
   aguarda `rollout status` por até 10 minutos.
7. O endpoint do cluster volta à configuração original, em passo
   `if: always()`.

Em PROD há ainda um Job de seed, condicionado à entrada explícita
`seed_prod: true`.

Em caso de falha, um passo de diagnóstico coleta `get pods -o wide`,
`describe deployment`, `describe pods` e as últimas 200 linhas de log de todos
os containers.

### Remoção

`cleanup-eks.yml` distingue os dois ambientes. Em HML, remove o namespace
inteiro. Em PROD, remove apenas os recursos que o deploy criou
(`targetgroupbinding`, `deployment`, `service`, `hpa`, `configmap`, `secret` e
Jobs marcados com `app.kubernetes.io/part-of=async-furious`), preservando
namespace, PVCs e ExternalSecrets. Destruir exige digitar a confirmação exata
`DESTROY HML` ou `DESTROY PROD`.

## 4. Pendências

- **`k8s/overlays/aws/` está órfão.** O diretório tem `kustomization.yaml`,
  `ingress.yaml`, um `migration-job.yaml` próprio e patches, mas nenhum
  workflow, script ou módulo Terraform o referencia (verificado por busca em
  `.github/`, `scripts/`, `Dockerfile` e `docker-compose*.yml`). O deploy real
  aplica os manifests base com substituição por `sed`. Além disso,
  `academy-service-patch.yaml` não está listado no próprio `kustomization.yaml`.
  Decidir entre adotar kustomize no pipeline ou remover o diretório.
- **Migração no ambiente local.** `k8s/app/migration-job.yaml` não é aplicado
  pelo módulo `kubernetes-apps`, o Deployment não tem mais `initContainers`, e
  o Dockerfile termina em `CMD ["node", "dist/main.js"]`. Não localizei, em
  `k8s/`, `infra/` ou `scripts/local-up.sh`, o que aplica as migrations no
  cluster `kind`.
- **`configmap.yaml` declara `JWT_ISSUER` duas vezes** (uma vazia, depois com
  `repo-auth-serverless`) e o mesmo vale para `JWT_AUDIENCE`. Em YAML a última
  chave vence, então hoje o valor efetivo é o correto, mas a duplicata é frágil
  e alguns validadores rejeitam o arquivo.
- **`terraform.yml` coleta logs de containers que não existem mais.** O passo
  de debug itera sobre `migrate`, `seed` e `api`; os dois primeiros saíram do
  Deployment quando a migração virou Job. As chamadas falham em silêncio por
  causa do `|| true`.
- Nenhuma `NetworkPolicy`, `PodSecurityStandard` ou `ResourceQuota` em nenhum
  dos dois ambientes.
- O StatefulSet local segue em Postgres `15-alpine`, enquanto CI e RDS usam 16.
  Divergência já registrada em [database.md](./database.md).
