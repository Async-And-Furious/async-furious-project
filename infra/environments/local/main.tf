terraform {
  # CI trigger: harmless Terraform-only change.
  required_version = ">= 1.6.0"

  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.4"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
}

module "kind_cluster" {
  source = "../../modules/kind-cluster"

  cluster_name       = var.cluster_name
  kubernetes_version = var.kubernetes_version
  node_port          = var.node_port
}

module "kubernetes_apps" {
  source = "../../modules/kubernetes-apps"

  kubeconfig          = module.kind_cluster.kubeconfig
  app_image           = var.app_image
  app_replicas        = var.app_replicas
  db_name             = var.db_name
  db_user             = var.db_user
  db_password         = var.db_password
  jwt_secret          = var.jwt_secret
  seed_admin_email    = var.seed_admin_email
  seed_admin_password = var.seed_admin_password
  k8s_manifests_path  = "${path.root}/../../../k8s"
}
