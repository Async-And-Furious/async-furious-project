terraform {
  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
}

provider "kubectl" {
  load_config_file       = false
  host                   = yamldecode(var.kubeconfig).clusters[0].cluster.server
  cluster_ca_certificate = base64decode(yamldecode(var.kubeconfig).clusters[0].cluster["certificate-authority-data"])
  token                  = yamldecode(var.kubeconfig).users[0].user.token
}

resource "kubectl_manifest" "namespace" {
  yaml_body = file("${var.k8s_manifests_path}/namespace.yaml")
}

resource "kubectl_manifest" "configmap" {
  yaml_body  = file("${var.k8s_manifests_path}/config/configmap.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "secret" {
  yaml_body = templatefile("${var.k8s_manifests_path}/config/secret.yaml", {
    jwt_secret  = var.jwt_secret
    db_password = var.db_password
  })
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "db_pvc" {
  yaml_body  = file("${var.k8s_manifests_path}/database/pvc.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "db_service" {
  yaml_body  = file("${var.k8s_manifests_path}/database/service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "db_statefulset" {
  yaml_body  = file("${var.k8s_manifests_path}/database/statefulset.yaml")
  depends_on = [kubectl_manifest.configmap, kubectl_manifest.secret, kubectl_manifest.db_pvc]
}

resource "kubectl_manifest" "app_deployment" {
  yaml_body  = file("${var.k8s_manifests_path}/app/deployment.yaml")
  depends_on = [kubectl_manifest.configmap, kubectl_manifest.secret, kubectl_manifest.db_statefulset]
}

resource "kubectl_manifest" "app_service" {
  yaml_body  = file("${var.k8s_manifests_path}/app/service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "app_hpa" {
  yaml_body  = file("${var.k8s_manifests_path}/app/hpa.yaml")
  depends_on = [kubectl_manifest.app_deployment]
}
