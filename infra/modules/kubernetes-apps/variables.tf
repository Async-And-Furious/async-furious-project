variable "kubeconfig" {
  type      = string
  sensitive = true
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

variable "seed_admin_email" {
  type = string
}

variable "seed_admin_password" {
  type      = string
  sensitive = true
}

variable "seed_recepcionista_password" {
  type      = string
  sensitive = true
}

variable "seed_mecanico_password" {
  type      = string
  sensitive = true
}

variable "k8s_manifests_path" {
  type    = string
  default = "../../../k8s"
}
