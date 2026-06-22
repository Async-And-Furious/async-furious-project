# AWS / EKS Environment (stub)

Not yet implemented. Migration path from local kind cluster:

1. Add `main.tf` using `hashicorp/aws` provider + `terraform-aws-modules/eks`
2. Push image to ECR, update `app_image` variable to ECR URI
3. Change App Service type to `LoadBalancer` (or add Ingress + AWS ALB controller)
4. Configure S3 backend for remote state in `main.tf`
5. K8s manifests in `/k8s` are reusable unchanged

Required providers to add:
```hcl
aws = {
  source  = "hashicorp/aws"
  version = "~> 5.0"
}
```
