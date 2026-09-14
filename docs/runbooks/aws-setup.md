# Pré-requisitos de setup da AWS

Este runbook anteriormente carregava uma cópia por repositório do handoff de
setup de conta. As quatro cópias divergiram entre si e todas descreviam uma
infraestrutura que não existe mais (um provedor OIDC do GitHub e uma role IAM
criada manualmente, um bucket `tc3-terraform-state` provisionado manualmente
com uma tabela DynamoDB `tc3-terraform-locks`, workspaces do HCP Terraform e
`TF_API_TOKEN`, e um gate de aprovação `hml-apply`).

Os documentos canônicos e atuais deveriam viver na raiz do workspace:

- `HANDOFF-AWS-SETUP.md` — o que uma pessoa configura, por caminho (AWS
  Academy ou uma conta real com OIDC), e o que o pipeline provisiona para si
  mesmo.
- `AWS_HML_RUNBOOK.md` — o procedimento do operador, os gates e o uso do
  `scripts/aws_lab.py`.

**Nenhum dos dois arquivos (`HANDOFF-AWS-SETUP.md` e `AWS_HML_RUNBOOK.md`) foi
localizado neste repositório**, nem na raiz, nem em nenhuma branch, nem no
histórico do git, nem em outro repositório da organização pesquisado via
GitHub. `TODO`: localizar ou reconstruir esses documentos; é possível que se
tratem de referências órfãs ou que pertençam a outro repositório do workspace
multi-repo do projeto que não foi identificado até o momento.

Versão resumida para este repositório: ele não possui state Terraform próprio
da AWS. `.github/workflows/terraform.yml` valida apenas o ambiente
local/kind em `infra/environments/local`. O caminho da AWS é
`.github/workflows/deploy-eks.yml`, que constrói uma imagem marcada pelo
commit SHA, envia (push) para o ECR, executa o job de migração uma vez, e
aplica a kustomization `k8s/overlays/aws` contra o cluster criado pelo
`repo-k8s-infra`.

Ele falha de forma segura (fail closed) sem estes valores no escopo do
repositório, que o `scripts/aws_lab.py` define antes de disparar o workflow:

| Nome                                                                | Tipo                              | Origem                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` | secret                            | sessão da AWS Academy                                                                                        |
| `AWS_DEPLOY_ROLE_ARN`                                               | secret                            | `LabRole` no modo Academy                                                                                    |
| `JWT_PRIVATE_KEY_SECRET_ARN`                                        | secret                            | registro do operador                                                                                         |
| `JWT_PUBLIC_KEY_PARAMETER_NAME`                                     | variable (repositório/ambiente)   | parâmetro SSM publicado pelo `repo-auth-serverless` (`/tc3/hml/jwt/public-key` ou `/tc3/prod/jwt/public-key`) |
| `AWS_REGION`, `ECR_REPOSITORY`, `EKS_CLUSTER_NAME`                  | variable                          | `scripts/aws_lab.py`                                                                                          |

O workflow de deploy usa os GitHub Environments `hml` e `production`, então
defina `JWT_PUBLIC_KEY_PARAMETER_NAME` na configuração correspondente de
repositório/ambiente. O workflow lê o valor do SSM Parameter Store com
descriptografia e mascara a chave pública antes de exportá-la para o deploy.

Antes de aplicar a configuração do Kubernetes, o workflow lê o
`repo-db-infra/<hml|prod>/terraform.tfstate` selecionado a partir do bucket
`tc3-tfstate-<account-id>` qualificado pela conta. Ele obtém
`db_connection_secret_arn`, `db_host`, `db_port`, `db_name` e `db_ssl_mode`
a partir dos outputs canônicos; os valores de conexão com o banco de dados,
portanto, não são variáveis do GitHub. O arquivo de state e as credenciais
obtidas nunca são exibidos.
