variable "cluster_name" {
  type    = string
  default = "async-furious"
}

variable "kubernetes_version" {
  type    = string
  default = "v1.29.0"
}

variable "node_port" {
  type    = number
  default = 30000
}
