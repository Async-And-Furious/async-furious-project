# Handoff — AWS account setup for CI/CD

You need IAM access to do this (you said you don't have it yet — this is
the exact list to hand to whoever does, or to run yourself once granted).

Nothing here is done automatically by any pipeline. It's one-time, manual,
console-or-CLI setup in the AWS account, done once, before the pipelines in
`repo-k8s-infra` / `repo-db-infra` can do anything beyond `terraform
validate`.

---

## 1. Why not just paste access keys into GitHub secrets?

Because we decided against it (RFC discussion, 2026-07-29): static AWS
access keys sitting in 3 repos' secrets never expire on their own, get
leaked in logs occasionally, and have to be rotated by hand forever.
**OIDC role-assumption** means GitHub Actions gets a short-lived token
minted per workflow run, no long-lived secret exists anywhere. This is the
standard, AWS-recommended pattern. One-time setup cost, zero rotation
cost forever after.

---

## 2. Create the GitHub OIDC identity provider (once per AWS account)

Console: IAM → Identity providers → Add provider.

- Provider type: OpenID Connect
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

Or CLI:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

This is account-wide — do it once, not per repo.

## 3. Create the IAM role GitHub Actions will assume

One role is enough for both `repo-k8s-infra` and `repo-db-infra` (same
account, same environment tier). Trust policy restricts *which* repos/
branches can assume it — this is the actual access control, not the OIDC
provider itself.

Trust policy (`trust-policy.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:Async-And-Furious/repo-k8s-infra:*",
            "repo:Async-And-Furious/repo-db-infra:*"
          ]
        }
      }
    }
  ]
}
```

```bash
aws iam create-role \
  --role-name tc3-github-actions-terraform \
  --assume-role-policy-document file://trust-policy.json
```

**Tighten this later**: right now `:*` allows any branch/PR/environment in
those two repos to assume the role. Once things stabilize, narrow the
`sub` condition to `repo:Async-And-Furious/repo-k8s-infra:ref:refs/heads/develop`
etc. so only pushes to `develop`/`main` (not arbitrary PR branches) can
assume it. Don't skip this before anything touches prod.

## 4. Attach a permissions policy to that role

What Terraform needs to actually provision, based on what's already
written in both repos:

- EC2/VPC (VPC, subnets, NAT gateway, security groups, route tables)
- EKS (cluster, node groups) — plus **IAM** (`iam:CreateRole`,
  `iam:AttachRolePolicy`, etc.) because the EKS module creates IAM roles
  for the cluster and node groups as part of provisioning
- ECR (repository, lifecycle policy)
- RDS (`aws_db_instance`, subnet group, security group)
- Secrets Manager (read/describe — needed because RDS's
  `manage_master_user_password` creates a secret automatically)
- S3 + DynamoDB (for the remote state backend itself, see §5)

For a class project, `PowerUserAccess` managed policy attached to this
role is the pragmatic shortcut (avoids hand-writing a huge least-privilege
JSON policy for a handful of resource types). If whoever owns the AWS
account wants tighter scoping instead, say so and I'll write the explicit
policy document.

## 5. Provision the Terraform remote state backend

This has to exist **before** `terraform init` (against the real backend,
not `-backend=false`) works in either repo's pipeline. Names must match
exactly what's already in the code:

```bash
aws s3api create-bucket --bucket tc3-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket tc3-terraform-state \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket tc3-terraform-state \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws dynamodb create-table \
  --table-name tc3-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Referenced from: `repo-k8s-infra/environments/{hml,prod}/backend.tf` and
`repo-db-infra/environments/{hml,prod}/backend.tf`.

## 6. Set the repo variable in GitHub

For **both** `repo-k8s-infra` and `repo-db-infra` (Settings → Secrets and
variables → Actions → Variables tab — a *variable*, not a *secret*, since
a role ARN isn't sensitive on its own):

```bash
gh variable set AWS_ROLE_ARN --body "arn:aws:iam::<ACCOUNT_ID>:role/tc3-github-actions-terraform" -R Async-And-Furious/repo-k8s-infra
gh variable set AWS_ROLE_ARN --body "arn:aws:iam::<ACCOUNT_ID>:role/tc3-github-actions-terraform" -R Async-And-Furious/repo-db-infra
```

## 7. Create the `hml-apply` GitHub Environment (manual approval gate)

For **both** repos: Settings → Environments → New environment → name it
exactly `hml-apply` → add yourself (or whoever should approve) as a
required reviewer.

This is what the `apply` job in each repo's `ci.yml` targets
(`environment: hml-apply`) — without this environment existing, the
`apply` job fails to even start, it doesn't skip silently.

## 8. Order of operations

1. OIDC provider (§2) — once per account.
2. IAM role + trust policy + permissions (§3–4).
3. S3 bucket + DynamoDB table (§5).
4. `AWS_ROLE_ARN` repo variable in both repos (§6).
5. `hml-apply` environment in both repos (§7).
6. Merge the pending CI/CD PRs (repo-k8s-infra #1, repo-db-infra #1) and
   the infra PRs (repo-k8s-infra #3, repo-db-infra #3) — review first,
   they've been sitting unmerged.
7. Push to `develop` in either repo → watch `plan` run for real → approve
   `apply` in the Actions tab when ready.

Expect the first real `plan` to surface things a `-backend=false` local
validate can't catch (IAM permission gaps, AZ availability, quota limits)
— that's normal, budget time to iterate once real credentials exist.
