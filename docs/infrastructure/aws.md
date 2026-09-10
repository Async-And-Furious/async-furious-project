# Infraestrutura AWS

> **[ATUAL]** Este documento descreve a infraestrutura de nuvem efetivamente
> provisionada por Terraform, não uma proposta. As evidências citadas apontam
> para arquivos reais nos quatro repositórios do projeto.
>
> Fontes: `repo-k8s-infra@release/v0.1.0`, `repo-db-infra@release/v0.1.0`,
> `repo-auth-serverless@release/v0.1.0` e este repositório em `develop`.
> Decisões em [ADR-0001](../adr/0001-separacao-quatro-repositorios.md),
> [ADR-0003](../adr/0003-kubernetes-eks-orquestracao.md),
> [ADR-0004](../adr/0004-banco-dados-gerenciado.md),
> [RFC-003](../rfcs/RFC-003-api-gateway-eks-integration.md),
> [RFC-004](../rfcs/RFC-004-vpc-ownership.md) e
> [RFC-007](../rfcs/RFC-007-rds-public-access.md).

## 1. Divisão de responsabilidades

Cada recurso AWS tem exatamente um repositório dono. Nenhum repositório cria
recurso que pertence a outro.

| Repositório | Provisiona | Não provisiona |
|---|---|---|
| `repo-k8s-infra` | VPC, subnets, EKS, node group, ECR, ALB interno, target group, AWS Load Balancer Controller, Metrics Server | Banco, Lambda, workloads da aplicação |
| `repo-db-infra` | RDS PostgreSQL, subnet group, parameter group, security group do banco, alarmes | VPC (consome de `repo-k8s-infra`) |
| `repo-auth-serverless` | Lambdas de autenticação, API Gateway HTTP, authorizer, VPC Link, alarmes | Cluster, banco, rede |
| `async-furious-project` (este) | Nenhum recurso AWS via Terraform. Publica imagem no ECR e aplica manifests Kubernetes no cluster alheio | Toda a infraestrutura acima |

Este repositório não possui estado Terraform na AWS. Seu
`.github/workflows/terraform.yml` valida apenas o ambiente local `kind` em
`infra/environments/local`.

## 2. Ambientes e convenção de nomes

Dois ambientes lógicos, `hml` e `prod`, na mesma conta AWS, separados por
chave de estado Terraform e por nome de recurso.

| Recurso | Nome | Evidência |
|---|---|---|
| VPC | `tc3-vpc-<env>` | `repo-k8s-infra/modules/vpc/main.tf:6` |
| Cluster EKS | `tc3-eks-<env>` | `repo-k8s-infra/modules/eks/main.tf:39` |
| Repositório ECR | `tc3-app-<env>` | `repo-k8s-infra/modules/ecr/main.tf:2` |
| ALB interno | `tc3-<env>-internal` | `repo-k8s-infra/modules/alb/main.tf:28` |
| Target group | `tc3-<env>-app` | `repo-k8s-infra/modules/alb/main.tf:37` |
| Instância RDS | `tc3-db-<env>` | `repo-db-infra/modules/rds/main.tf:65` |
| HTTP API | `tc3-auth-<env>` | `.github/workflows/deploy-eks.yml:758,794` (o smoke test localiza a API por esse nome) |

Região padrão `us-east-1`, sobrescrevível pela variável de repositório
`AWS_REGION`. Todos os recursos de `repo-k8s-infra` recebem as tags padrão
`Project=tc3`, `Environment=<env>`, `ManagedBy=terraform`.

## 3. Estado Terraform e integração entre repositórios

O estado fica em um bucket S3 nomeado pela conta: `tc3-tfstate-<account_id>`.
Cada repositório grava sob sua própria chave.

```
s3://tc3-tfstate-<account_id>/repo-k8s-infra/<env>/terraform.tfstate
s3://tc3-tfstate-<account_id>/repo-db-infra/<env>/terraform.tfstate
```

Esse bucket é o mecanismo de integração entre os repositórios, resolvendo o
problema levantado pela [RFC-004](../rfcs/RFC-004-vpc-ownership.md). Há duas
formas de consumo em uso:

**Remote state nativo.** `repo-db-infra` lê os outputs de `repo-k8s-infra`
via `data "terraform_remote_state"`, sem cópia manual de IDs para `tfvars`
(`repo-db-infra/main.tf:18-27`). É assim que ele descobre `vpc_id`,
`public_subnet_ids` e `node_security_group_id`.

**Leitura do arquivo de estado no pipeline.** Este repositório não roda
Terraform contra a AWS, então o `deploy-eks.yml` baixa o `terraform.tfstate`
dos outros dois com `aws s3 cp` e extrai os outputs com `jq`
(`.github/workflows/deploy-eks.yml:185-225`). Os valores lidos são:

| Origem | Output | Uso |
|---|---|---|
| `repo-k8s-infra` | `application_target_group_arn` (fallback `internal_alb_target_group_arn`) | Preenche o `TargetGroupBinding` que registra os pods no ALB |
| `repo-db-infra` | `db_connection_secret_arn` (fallback `db_secret_arn`) | Busca usuário e senha no Secrets Manager |
| `repo-db-infra` | `db_host`, `db_port`, `db_name`, `db_ssl_mode` | Monta a `DATABASE_URL` do Secret Kubernetes |

O ARN do target group é validado por expressão regular antes do uso, e host e
ARN do segredo são mascarados no log do runner.

Consequência operacional: a ordem de provisionamento é obrigatória. Rede e
cluster primeiro, banco depois, borda serverless por último, aplicação ao
final.

## 4. Rede

`repo-k8s-infra/modules/vpc` usa o módulo oficial `terraform-aws-modules/vpc`
(`~> 5.13`) com CIDR `10.0.0.0/16` em duas AZs (`us-east-1a`, `us-east-1b`).
As subnets são derivadas por `cidrsubnet`: as públicas ocupam os índices 0 e 1,
as privadas os índices 10 e 11.

O cluster EKS fica nas subnets privadas. O ALB é interno
(`internal = true`), também em subnets privadas, e nunca é exposto à internet.
Seu security group aceita tráfego apenas do CIDR da própria VPC
(`repo-k8s-infra/modules/alb/main.tf:15,23`). A única porta de entrada pública
do sistema é o API Gateway.

## 5. Computação: EKS

| Item | Valor | Evidência |
|---|---|---|
| Versão do Kubernetes | `1.30` | `modules/eks/variables.tf` |
| Tipo de instância dos nós | `t3.medium` | `modules/eks/variables.tf` |
| Node group | desired 2, min 1, max 3 | `modules/eks/variables.tf` |
| Endpoint da API | privado por padrão (`cluster_endpoint_public_access = false`) | `modules/eks/variables.tf` |

Dois add-ons são instalados por Helm com versão fixada, direto do Terraform
(`repo-k8s-infra/main.tf:64,99`):

- **AWS Load Balancer Controller** `1.8.2`, que traz o CRD
  `TargetGroupBinding` usado pela aplicação para se registrar no ALB.
- **Metrics Server** `3.12.2`, pré-requisito do HPA.

O endpoint privado tem uma consequência direta no pipeline: o runner do GitHub
Actions não alcança a API do cluster. O `deploy-eks.yml` resolve isso abrindo o
endpoint temporariamente apenas para o IP do runner, com `/32`, e restaurando a
configuração original em um passo `if: always()`
(`.github/workflows/deploy-eks.yml:226-285,397`). O mesmo padrão existe no
`cleanup-eks.yml`.

## 6. Registry: ECR

Repositório `tc3-app-<env>` com `image_tag_mutability = IMMUTABLE` e
`scan_on_push = true`. Política de ciclo de vida expira imagens sem tag após 7
dias (`repo-k8s-infra/modules/ecr/main.tf`).

A imutabilidade da tag é intencional e o pipeline foi escrito em torno dela: a
tag é o SHA do commit, e o job de build primeiro verifica se a imagem já existe
(`aws ecr describe-images`). Se existir, reusa; se o push falhar por tag
imutável já publicada, trata como corrida vencida por outro job e segue com o
digest existente. O que é passado adiante para o deploy não é a tag, é o
digest (`registry/repo@sha256:...`), o que garante que HML e PROD rodam
exatamente o mesmo binário (`.github/workflows/deploy-eks.yml:99-139`).

## 7. Banco de dados gerenciado: RDS

| Item | Valor |
|---|---|
| Engine | PostgreSQL `16.4` |
| Classe | `db.t4g.micro` (padrão) |
| Armazenamento | 20 GB, criptografado (`storage_encrypted = true`) |
| Database | `workshop`, usuário `postgres` |
| Senha | gerenciada pelo RDS via Secrets Manager (`manage_master_user_password = true`), nunca no estado Terraform |
| Backup | 7 dias em PROD, 1 dia em HML |
| Multi-AZ | somente PROD |
| Proteção de deleção e snapshot final | somente PROD |
| SSL | obrigatório, `rds.force_ssl = 1` no parameter group |

A diferença de exposição entre ambientes é imposta por `precondition` e
`postcondition` no próprio recurso: HML **precisa** ser público, PROD
**precisa** ser privado, e o plano falha se a variável divergir
(`repo-db-infra/modules/rds/main.tf:93-100`). HML em subnet pública é a
exceção aprovada na [RFC-007](../rfcs/RFC-007-rds-public-access.md), com CIDRs
explícitos e estreitos; `0.0.0.0/0` é rejeitado. PROD só aceita ingresso por
security group, incluindo o SG dos nós do EKS lido do estado de
`repo-k8s-infra`.

Há ainda uma validação que confere se as subnets informadas têm (HML) ou não
têm (PROD) rota para Internet Gateway, falhando o plano se a topologia não
corresponder à política do ambiente (`repo-db-infra/main.tf:67-85`).

Três alarmes CloudWatch acompanham a instância: CPU acima de 80%, armazenamento
livre abaixo de 2 GiB e conexões acima de 80. Os alarmes são criados sem ação
de notificação, para que a conta anexe seus próprios destinos depois.

Ver [database.md](./database.md) para o modelo de dados e o histórico da
decisão de versão.

## 8. Borda: API Gateway e Lambda

Documentado em detalhe em
[api-gateway-lambda.md](./api-gateway-lambda.md). Em resumo: um HTTP API v2
por ambiente, uma Lambda que emite JWT RS256 a partir do CPF, um Lambda
Authorizer que valida o token, e uma integração `HTTP_PROXY` via VPC Link que
encaminha as rotas protegidas para o ALB interno.

## 9. Segredos e parâmetros

| Onde | O que | Quem escreve | Quem lê |
|---|---|---|---|
| Secrets Manager | Credenciais master do RDS (JSON com `username`/`password`) | RDS | `deploy-eks.yml`, Lambda de autenticação |
| Secrets Manager | Chave privada RS256 | Operador | Lambda `authenticate-customer` |
| SSM Parameter Store | Chave pública RS256 | Operador | Lambda `authorize-request` e `deploy-eks.yml` |
| Secret Kubernetes `async-furious-secret` | `DATABASE_URL`, credenciais, `JWT_PUBLIC_KEY`, `WEBHOOK_SECRET`, seeds | `deploy-eks.yml`, em tempo de deploy | Pods da aplicação |

Nenhuma credencial de banco é output Terraform nem variável do GitHub. O
pipeline resolve o ARN do segredo pelo estado remoto, busca o JSON no Secrets
Manager, faz percent-encoding de usuário e senha em Python antes de montar a
`DATABASE_URL`, e aplica o Secret por `kubectl create ... --dry-run=client -o
yaml | kubectl apply -f -` (`.github/workflows/deploy-eks.yml:297-325`). Os
valores são mascarados com `::add-mask::`.

Ver [ADR-0015](../adr/0015-segredos-kubernetes-templatefile.md) para o
tratamento equivalente no ambiente local e
[RFC-006](../rfcs/RFC-006-secrets-and-jwt.md) para a estratégia de chaves.

## 10. Modo AWS Academy

O projeto roda em conta AWS Academy, que não permite criar roles IAM
arbitrárias. Os três repositórios de infraestrutura têm uma variável
`aws_academy` (e `manage_iam`, `lab_role_arn`) que, quando ativada, faz os
módulos reusarem a `LabRole` existente em vez de criar IRSA ou roles próprias
(`repo-k8s-infra/variables.tf`, `repo-auth-serverless/infra/hml/variables.tf`).

A autenticação dos workflows acompanha essa restrição: em vez de OIDC, os
pipelines usam `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e
`AWS_SESSION_TOKEN` da sessão Academy, que expiram e precisam ser renovados a
cada sessão. Ver [aws-setup.md](../runbooks/aws-setup.md).

Em HML, o ECR é criado com `force_delete = true` para permitir destruir o
ambiente sem esvaziar o registry manualmente.

## 11. Ordem de provisionamento

```mermaid
flowchart LR
    k8s["repo-k8s-infra<br/>VPC, EKS, ECR, ALB"]
    db["repo-db-infra<br/>RDS"]
    auth["repo-auth-serverless<br/>API Gateway, Lambdas"]
    app["async-furious-project<br/>imagem + manifests"]

    k8s -->|"vpc_id, subnets, node SG<br/>(remote state)"| db
    k8s -->|"subnets, SG do ALB<br/>DNS interno"| auth
    db -->|"secret ARN, host, port<br/>(estado lido no pipeline)"| app
    k8s -->|"target group ARN<br/>(estado lido no pipeline)"| app
    auth -->|"chave pública RS256 (SSM)<br/>issuer, audience"| app
```

## 12. Pendências

- Não há Terraform de bootstrap para o bucket `tc3-tfstate-<account_id>`. Ele é
  criado por scripts nos próprios repositórios
  (`.github/scripts/bootstrap-backend.sh` em `repo-k8s-infra`, `repo-db-infra`
  e `repo-auth-serverless`), fora do ciclo de vida do Terraform. O mesmo script
  gera o `backend.hcl` por ambiente a partir do ID da conta viva, o que explica
  por que os arquivos `backend.tf` versionados são configurações parciais
  (`backend "s3" {}`) sem bucket nem chave.
- O travamento de estado usa o lock nativo do S3 (`use_lockfile = true`,
  Terraform 1.11+), escrito no `backend.hcl` gerado. Não há tabela DynamoDB
  para provisionar.
- O ALB interno serve HTTP na porta 80, sem TLS. É uma exceção documentada com
  `#trivy:ignore:AWS-0054` no código, justificada por não haver certificado ACM
  nem domínio contratado. O TLS termina no API Gateway.
- `k8s/overlays/aws/` (kustomization, ingress, patches) existe no repositório
  mas não é referenciado por nenhum workflow ou script. O deploy real aplica os
  manifests base com substituição via `sed`. Ver
  [kubernetes.md](./kubernetes.md).
- `infra/environments/aws/README.md` ainda descreve a migração para EKS como
  não implementada e cita autenticação por OIDC, que não é o caminho em uso.
