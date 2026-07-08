output "kubeconfig" {
  value     = kind_cluster.this.kubeconfig
  sensitive = true
}

output "cluster_name" {
  value = kind_cluster.this.name
}

output "endpoint" {
  value = kind_cluster.this.endpoint
}
