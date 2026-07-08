output "cluster_name" {
  value = module.kind_cluster.cluster_name
}

output "cluster_endpoint" {
  value = module.kind_cluster.endpoint
}

output "app_url" {
  value = "http://localhost:${var.node_port}"
}

output "kubeconfig" {
  value     = module.kind_cluster.kubeconfig
  sensitive = true
}
