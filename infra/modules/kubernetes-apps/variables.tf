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

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "jwt_public_key" {
  type      = string
  sensitive = true
}

variable "webhook_secret" {
  type      = string
  sensitive = true
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "target_group_arn" {
  type = string
}

variable "enable_local_database" {
  type    = bool
  default = false
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
  default   = ""
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
