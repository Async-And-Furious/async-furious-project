# AWS / EKS

Não há Terraform de AWS neste diretório, e não deve haver: o provisionamento da
nuvem pertence a `repo-k8s-infra`, `repo-db-infra` e `repo-auth-serverless`.
Este repositório apenas publica a imagem no ECR e aplica manifests em um
cluster que já existe.

O `infra/` local cobre somente o ambiente `kind`, em
`infra/environments/local`.

A documentação canônica da nuvem está em `docs/`:

| Assunto | Documento |
|---|---|
| Recursos AWS, ownership, estado Terraform compartilhado | [`docs/infrastructure/aws.md`](../../../docs/infrastructure/aws.md) |
| Borda serverless e contrato do token | [`docs/infrastructure/api-gateway-lambda.md`](../../../docs/infrastructure/api-gateway-lambda.md) |
| Clusters e sequência de deploy | [`docs/infrastructure/kubernetes.md`](../../../docs/infrastructure/kubernetes.md) |
| Pipelines e gates | [`docs/infrastructure/cicd.md`](../../../docs/infrastructure/cicd.md) |
| Segredos, variáveis e pré-requisitos | [`docs/runbooks/aws-setup.md`](../../../docs/runbooks/aws-setup.md) |

A versão anterior deste arquivo descrevia um pipeline que não existe mais
(fallback OIDC com `AWS_DEPLOY_ROLE_ARN`, runner self-hosted rotulado
`eks-private`, input `aws_academy` no workflow de deploy, uso do overlay
`k8s/overlays/aws` e autenticação de CPF em `POST /api/v1/auth/login`). Ela foi
removida em vez de corrigida, para não manter uma quarta cópia divergente do
mesmo assunto.
