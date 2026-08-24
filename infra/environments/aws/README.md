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
- In normal mode, before deployment, the `async-furious` namespace must already
  contain the managed Secret `async-furious-secret` with non-empty
  `DATABASE_URL`, `JWT_PUBLIC_KEY`, and explicitly provisioned
  `JWT_PRIVATE_KEY` keys. In Academy mode, configure the protected GitHub
  Environment with secrets `DATABASE_SECRET_ARN` and
  `JWT_PRIVATE_KEY_SECRET_ARN`, plus variable `JWT_PUBLIC_KEY_PARAMETER_NAME`.
  The workflow fails closed if these references are absent, reads the RDS
  Secrets Manager JSON fields `username`, `password`, `host`, `port`, and
  `dbname`, reads both JWT values from AWS, constructs `DATABASE_URL`, and
  applies only the three required keys to `async-furious-secret`. Values are
  never logged or committed. The ConfigMap must set `JWT_ALGORITHM=RS256`,
  `JWT_ISSUER=repo-auth-serverless`, `JWT_AUDIENCE=async-furious-project`, and
  `JWT_EXPIRES_IN=1800`.
- Normal mode (the default) requires the AWS Load Balancer Controller for the
  internal ALB Ingress. AWS Academy mode does not use the controller or IRSA;
  it renders no Ingress and changes `async-furious-service` to `LoadBalancer`.
- In normal mode, the GitHub Actions runner must be self-hosted, labeled
  `linux` and `eks-private`, and have network/DNS access to the private EKS API
  endpoint. Academy mode uses `ubuntu-latest` instead. Keep the EKS endpoint
  private for normal mode; the hosted runner requires an Academy cluster endpoint
  reachable from GitHub-hosted infrastructure. Both modes need Docker, AWS CLI,
  and `kubectl`. OIDC access is required only when using the OIDC fallback.

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

The `k8s/overlays/aws` overlay keeps the ClusterIP Service and adds an internal
ALB Ingress by default. Dispatch `.github/workflows/deploy-eks.yml` with
`aws_academy=true` for Academy mode; the workflow removes `ingress.yaml`,
patches the Service to `LoadBalancer`, waits for its external hostname/IP, and
publishes `http://<endpoint>:3000` in the workflow summary. The workflow
references the existing ConfigMap/Secret, includes the controlled Prisma
migration Job, pushes a commit-SHA-tagged ECR image, applies it by digest, and
stops if migration, rollout, or the live health check fails. It does not
provision AWS, create IAM resources, or run Terraform.

### Backend URL contract for Auth

Use the published backend URL as Auth's backend base URL, without a trailing
slash: `http://<service-external-hostname-or-ip>:3000`. Auth calls the API under
`/api/v1`; for example, CPF authentication is `POST
<backend-url>/api/v1/auth/login` with its existing request contract. The API
returns JWTs for protected application routes; Auth should forward the token in
the `Authorization: Bearer <jwt>` header. In normal ALB mode, substitute the
ALB hostname (normally `http://<alb-hostname>`) for the Academy URL.
