terraform {
  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
  }
}

locals {
  kube = yamldecode(var.kubeconfig)
}

provider "kubectl" {
  load_config_file       = false
  host                   = local.kube.clusters[0].cluster.server
  cluster_ca_certificate = base64decode(local.kube.clusters[0].cluster["certificate-authority-data"])
  client_certificate     = base64decode(local.kube.users[0].user["client-certificate-data"])
  client_key             = base64decode(local.kube.users[0].user["client-key-data"])
}

# metrics-server required for HPA to function in KinD
resource "kubectl_manifest" "metrics_server" {
  yaml_body = <<-YAML
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: metrics-server
      namespace: kube-system
      labels:
        k8s-app: metrics-server
    spec:
      selector:
        matchLabels:
          k8s-app: metrics-server
      template:
        metadata:
          labels:
            k8s-app: metrics-server
        spec:
          hostNetwork: true
          containers:
            - name: metrics-server
              image: registry.k8s.io/metrics-server/metrics-server:v0.7.2
              args:
                - --cert-dir=/tmp
                - --secure-port=10250
                - --kubelet-preferred-address-types=InternalIP
                - --kubelet-use-node-status-port
                - --metric-resolution=15s
                - --kubelet-insecure-tls
              ports:
                - containerPort: 10250
                  name: https
                  protocol: TCP
              resources:
                requests:
                  cpu: 100m
                  memory: 200Mi
  YAML
}

resource "kubectl_manifest" "metrics_server_service" {
  yaml_body  = <<-YAML
    apiVersion: v1
    kind: Service
    metadata:
      name: metrics-server
      namespace: kube-system
      labels:
        k8s-app: metrics-server
    spec:
      ports:
        - name: https
          port: 443
          protocol: TCP
          targetPort: https
      selector:
        k8s-app: metrics-server
  YAML
  depends_on = [kubectl_manifest.metrics_server]
}

resource "kubectl_manifest" "metrics_server_apiservice" {
  yaml_body  = <<-YAML
    apiVersion: apiregistration.k8s.io/v1
    kind: APIService
    metadata:
      name: v1beta1.metrics.k8s.io
    spec:
      service:
        name: metrics-server
        namespace: kube-system
      group: metrics.k8s.io
      version: v1beta1
      insecureSkipTLSVerify: true
      groupPriorityMinimum: 100
      versionPriority: 100
  YAML
  depends_on = [kubectl_manifest.metrics_server_service]
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
    db_name     = var.db_name
    db_user     = var.db_user
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
