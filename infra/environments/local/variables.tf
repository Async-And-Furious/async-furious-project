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

variable "app_image" {
  type    = string
  default = "async-furious-api:local"
}

variable "app_replicas" {
  type    = number
  default = 2
}

variable "db_name" {
  type    = string
  default = "workshop"
}

variable "db_user" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}
