# Pré-requisitos de configuração AWS

Este runbook lista o que precisa estar configurado para os workflows de nuvem
deste repositório rodarem. Versões anteriores dele apontavam para
`HANDOFF-AWS-SETUP.md`, `AWS_HML_RUNBOOK.md` e `scripts/aws_lab.py` como
documentos canônicos: nenhum desses três arquivos existe em qualquer branch
deste repositório, e as referências foram removidas.

Para a descrição dos recursos AWS em si, ver
[aws.md](../infrastructure/aws.md).

## 1. O que este repositório possui

Nenhum estado Terraform na AWS. `.github/workflows/terraform.yml` valida e
aplica apenas o ambiente local `kind`, em `infra/environments/local`.

O caminho de nuvem é `.github/workflows/deploy-eks.yml`, que publica a imagem
no ECR e aplica manifests Kubernetes em um cluster criado por
`repo-k8s-infra`. Ele falha antes de tocar o cluster se qualquer pré-requisito
abaixo faltar.

## 2. Ordem de provisionamento

Antes do primeiro deploy da aplicação, aplicar nesta ordem:

1. `repo-k8s-infra` (VPC, EKS, ECR, ALB e target group)
2. `repo-db-infra` (RDS; lê o estado do anterior)
3. `repo-auth-serverless` (Lambdas, API Gateway, VPC Link)

O deploy da aplicação lê os estados de `repo-k8s-infra` e `repo-db-infra`
diretamente do bucket `tc3-tfstate-<account-id>`, então precisa que os dois já
tenham sido aplicados no ambiente alvo.

## 3. GitHub Environments

Os workflows usam os Environments `hml` e `production`. Um valor definido
apenas no escopo do repositório funciona para ambos; um valor definido em um
Environment só resolve nos jobs daquele Environment.

### Segredos

| Nome | Usado por | Origem |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `deploy-eks.yml`, `cleanup-eks.yml` | sessão AWS Academy |
| `AWS_SECRET_ACCESS_KEY` | `deploy-eks.yml`, `cleanup-eks.yml` | sessão AWS Academy |
| `AWS_SESSION_TOKEN` | ambos, apenas no modo Academy | sessão AWS Academy |
| `JWT_SECRET` | `deploy-eks.yml` | operador |
| `WEBHOOK_SECRET` | `deploy-eks.yml` | operador |
| `SEED_ADMIN_EMAIL` | `deploy-eks.yml` | operador |
| `SEED_ADMIN_PASSWORD` | `deploy-eks.yml` | operador |

As credenciais Academy expiram junto com a sessão do laboratório e precisam ser
renovadas antes de cada execução.

### Variáveis

| Nome | Padrão | Observação |
|---|---|---|
| `AWS_REGION` | `us-east-1` | |
| `ECR_REPOSITORY` | nenhum | obrigatória; o preflight falha sem ela |
| `EKS_CLUSTER_NAME` | nenhum | `tc3-eks-hml` ou `tc3-eks-prod` |
| `K8S_NAMESPACE` | `async-furious` | |
| `JWT_ISSUER` | nenhum | `repo-auth-serverless`, travado por validação no Terraform da borda |
| `JWT_AUDIENCE` | nenhum | `async-furious-project`, idem |
| `JWT_PUBLIC_KEY_PARAMETER_NAME` | nenhum | nome do parâmetro SSM publicado por `repo-auth-serverless` |
| `ECR_REPOSITORY_OVERRIDE` | `tc3-app-<env>` | apenas `cleanup-eks.yml` |
| `ECR_CLEANUP_OWNED` | nenhum | apenas `cleanup-eks.yml`; a limpeza de imagens em produção é recusada se não for `true` |

### Segredos do workflow local

`terraform.yml` usa segredos próprios, com prefixo `TF_VAR_`, para o cluster
`kind` efêmero: `TF_VAR_DB_PASSWORD`, `TF_VAR_JWT_SECRET`,
`TF_VAR_SEED_ADMIN_EMAIL`, `TF_VAR_SEED_ADMIN_PASSWORD`,
`TF_VAR_SEED_RECEPCIONISTA_PASSWORD` e `TF_VAR_SEED_MECANICO_PASSWORD`. Eles
não têm relação com a AWS.

## 4. O que o pipeline resolve sozinho

Nem toda configuração é variável do GitHub. O deploy descobre em tempo de
execução:

| Valor | Como |
|---|---|
| ARN do target group | `aws s3 cp` do estado de `repo-k8s-infra`, campo `application_target_group_arn` |
| Host, porta, nome e modo SSL do banco | estado de `repo-db-infra` |
| ARN do segredo do banco | estado de `repo-db-infra`, campo `db_connection_secret_arn` |
| Usuário e senha do banco | `aws secretsmanager get-secret-value` sobre o ARN acima |
| Chave pública RS256 | `aws ssm get-parameter --with-decryption` |
| Registry do ECR | `aws sts get-caller-identity` |

Nenhuma credencial de banco é variável do GitHub. O arquivo de estado e os
valores buscados são mascarados e nunca impressos.

## 5. Acesso ao cluster pelo runner

O endpoint da API do EKS é privado. O deploy salva a configuração de acesso
original, abre o endpoint apenas para o IP público do runner com máscara `/32`,
aplica, e restaura a configuração anterior em um passo `if: always()`. Se o
workflow for cancelado à força durante a janela, a restauração pode não rodar,
e o endpoint fica aberto para um IP que não é mais o do runner. Conferir com:

```bash
aws eks describe-cluster --name tc3-eks-hml --query 'cluster.resourcesVpcConfig'
```

## 6. Destruição

`down.yml` chama `cleanup-eks.yml` e exige a confirmação exata `DESTROY HML` ou
`DESTROY PROD`. Em HML o namespace inteiro é removido; em produção só os
recursos que o deploy criou. Destruir a infraestrutura em si (cluster, banco,
borda) é feito nos respectivos repositórios, pela ação `destroy` dos seus
pipelines, com a mesma exigência de confirmação digitada.
