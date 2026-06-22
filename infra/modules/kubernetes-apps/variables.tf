variable "kubeconfig" {
  type      = string
  sensitive = true
}

variable "app_image" {
  type    = string
  default = "async-furious-api:latest"
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

variable "k8s_manifests_path" {
  type    = string
  default = "../../../k8s"
}
