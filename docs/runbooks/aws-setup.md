# AWS setup prerequisites

This runbook previously carried a per-repository copy of the account-setup
handoff. The four copies drifted apart and all of them described infrastructure
that no longer exists (a GitHub OIDC provider and hand-created IAM role, a
manually provisioned `tc3-terraform-state` bucket with a `tc3-terraform-locks`
DynamoDB table, HCP Terraform workspaces and `TF_API_TOKEN`, and an `hml-apply`
approval gate).

The canonical, current documents live in the workspace root:

- `HANDOFF-AWS-SETUP.md` — what a human sets up, per path (AWS Academy or a
  real account with OIDC), and what the pipeline provisions for itself.
- `AWS_HML_RUNBOOK.md` — the operator procedure, gates, and
  `scripts/aws_lab.py` usage.

Short version for this repository: it owns no AWS Terraform state.
`.github/workflows/terraform.yml` only validates the local/kind environment
under `infra/environments/local`. The AWS path is
`.github/workflows/deploy-eks.yml`, which builds an image tagged by commit SHA,
pushes it to ECR, runs the migration job once, and applies the `k8s/overlays/aws`
kustomization against the cluster created by `repo-k8s-infra`.

It fails closed without these repository-scoped values, which
`scripts/aws_lab.py` sets before dispatching it:

| Name                                                                | Kind                              | Source                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` | secret                            | AWS Academy session                                                                                         |
| `AWS_DEPLOY_ROLE_ARN`                                               | secret                            | `LabRole` in Academy mode                                                                                   |
| `DATABASE_SECRET_ARN`                                               | secret                            | discovered from RDS                                                                                         |
| `JWT_PRIVATE_KEY_SECRET_ARN`                                        | secret                            | operator record                                                                                             |
| `JWT_PUBLIC_KEY_PARAMETER_NAME`                                     | variable (repository/environment) | SSM parameter published by `repo-auth-serverless` (`/tc3/hml/jwt/public-key` or `/tc3/prod/jwt/public-key`) |
| `AWS_REGION`, `ECR_REPOSITORY`, `EKS_CLUSTER_NAME`                  | variable                          | `scripts/aws_lab.py`                                                                                        |

The deployment workflow uses the `hml` and `production` GitHub Environments, so
set `JWT_PUBLIC_KEY_PARAMETER_NAME` in the matching repository/environment
configuration. The workflow reads the value from SSM Parameter Store with
decryption and masks the public key before exporting it to the deployment.
