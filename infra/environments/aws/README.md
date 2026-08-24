# AWS / EKS deployment

AWS provisioning is intentionally outside this repository. The manual
`.github/workflows/deploy-eks.yml` workflow deploys to an existing EKS cluster
after the GitHub Environment approval gate.

Required repository/environment configuration:

- Variables: `AWS_REGION`, `ECR_REPOSITORY`, `EKS_CLUSTER_NAME`.
- Secrets: `AWS_DEPLOY_ROLE_ARN` (GitHub OIDC role), or the temporary AWS
  Academy credentials `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
  `AWS_SESSION_TOKEN`.
  When all three Academy secrets are present, the workflow uses them directly;
  otherwise it falls back to OIDC and `AWS_DEPLOY_ROLE_ARN`.
- Before deployment, the `async-furious` namespace must already contain the
  managed Secret `async-furious-secret` with non-empty `DATABASE_URL`,
  `JWT_PUBLIC_KEY`, and explicitly provisioned `JWT_PRIVATE_KEY` keys. The
  ConfigMap must set `JWT_ALGORITHM=RS256`, `JWT_ISSUER=repo-auth-serverless`,
  `JWT_AUDIENCE=async-furious-project`, and `JWT_EXPIRES_IN=1800`. The private
  key is runtime secret material and must never be committed.
  `DATABASE_URL` must point to the AWS managed database;
  the workflow does not accept or construct a local PostgreSQL `DB_HOST`.
- The AWS Load Balancer Controller must already be installed in EKS.
- The GitHub Actions runner must be self-hosted, labeled `linux` and
  `eks-private`, and have network/DNS access to the private EKS API endpoint.
  Keep the EKS endpoint private; do not make it public to accommodate the
  runner. The runner also needs Docker, AWS CLI, and `kubectl`. OIDC access is
  required only when using the OIDC fallback.

## Rotate AWS Academy credentials

Set the three values as GitHub Environment secrets so the deployment approval
gate selects the correct credentials. Do not commit or write the values to a
file. In PowerShell, enter each value when prompted and send it directly to
`gh`:

```powershell
$environmentName = "homolog"
$env:AWS_ACCESS_KEY_ID = Read-Host "AWS access key ID"
$env:AWS_SECRET_ACCESS_KEY = Read-Host "AWS secret access key"
$env:AWS_SESSION_TOKEN = Read-Host "AWS session token"
gh secret set AWS_ACCESS_KEY_ID --env $environmentName --body $env:AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY --env $environmentName --body $env:AWS_SECRET_ACCESS_KEY
gh secret set AWS_SESSION_TOKEN --env $environmentName --body $env:AWS_SESSION_TOKEN
Remove-Item Env:AWS_ACCESS_KEY_ID,Env:AWS_SECRET_ACCESS_KEY,Env:AWS_SESSION_TOKEN
```

Run the same commands once per GitHub Environment (for example, `homolog` and
`production`). To use repository-level secrets instead, omit `--env
$environmentName` from each `gh secret set` command. Rotate all three values
together when AWS Academy issues a new session; expired sessions must be
replaced before dispatching the workflow.

The `k8s/overlays/aws` overlay keeps the ClusterIP Service, adds an internal
ALB Ingress, references the existing ConfigMap/Secret, and includes the
controlled Prisma migration Job. The workflow pushes a commit-SHA-tagged ECR
image and applies it by digest. It renders numeric AWS replicas without
changing local manifests, runs and waits for the migration Job before applying
the API Deployment, and stops if the migration fails. It does not provision
AWS or run Terraform.
