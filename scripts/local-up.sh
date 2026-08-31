#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="async-furious"
IMAGE_NAME="async-furious-api:local"
INFRA_DIR="$(cd "$(dirname "$0")/../infra/environments/local" && pwd)"
NAMESPACE="async-furious"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[local-up]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── prereqs ──────────────────────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."
  for cmd in docker kind terraform kubectl; do
    command -v "$cmd" &>/dev/null || die "'$cmd' not found in PATH"
  done
  ok "All prerequisites present"
}

# ── secrets ───────────────────────────────────────────────────────────────────
load_secrets() {
  if [[ -f "$(dirname "$0")/../.env.local" ]]; then
    # shellcheck disable=SC1091
    source "$(dirname "$0")/../.env.local"
  fi

  # Terraform maps TF_VAR_<name> to var.<name> case-sensitively, so the suffix
  # must match the lowercase variable names (db_password, jwt_secret,
  # seed_admin_email, seed_admin_password, seed_recepcionista_password, seed_mecanico_password) declared in
  # infra/environments/local/variables.tf — ALL_CAPS here would break it.
  local required=(TF_VAR_db_password TF_VAR_jwt_secret TF_VAR_seed_admin_email TF_VAR_seed_admin_password TF_VAR_seed_recepcionista_password TF_VAR_seed_mecanico_password)
  local prompts=("Enter DB password: " "Enter JWT secret: " "Enter seed admin email: " "Enter seed admin password: " "Enter seed recepcionista password: " "Enter seed mecanico password: ")
  local defaults=("" "" "" "" "" "")

  for i in "${!required[@]}"; do
    local var="${required[$i]}"
    if [[ -z "${!var:-}" ]]; then
      if [[ ! -t 0 ]]; then
        die "$var is not set and no TTY is available to prompt for it (CI run). Set it as a repo/environment secret."
      fi
      read -r -s -p "${prompts[$i]}" "$var"; echo
      if [[ -z "${!var:-}" ]]; then
        printf -v "$var" '%s' "${defaults[$i]}"
        warn "Using default value for $var (local dev only — do not use in production)"
      fi
      export "$var" # NOSONAR
    fi
  done
}

# ── docker build ──────────────────────────────────────────────────────────────
build_image() {
  log "Building Docker image $IMAGE_NAME..."
  docker build -t "$IMAGE_NAME" "$(dirname "$0")/.."
  ok "Image built"
}

# ── terraform ─────────────────────────────────────────────────────────────────
# Applied in two passes: first just the kind cluster, so the image can be
# loaded into it before the app Deployment (imagePullPolicy: Never) is
# created. Otherwise pods land with ErrImageNeverPull and burn the readiness
# wait timeout retrying pulls until load_image finally lands.
terraform_init() {
  log "Running terraform init..."
  terraform -chdir="$INFRA_DIR" init -upgrade -input=false
}

terraform_apply_cluster() {
  log "Running terraform apply (kind cluster only)..."
  terraform -chdir="$INFRA_DIR" apply -auto-approve -input=false -target=module.kind_cluster
  ok "Terraform apply (cluster) complete"
}

terraform_apply_full() {
  local plan_file="$INFRA_DIR/.tfplan"
  log "Generating Terraform plan (full)..."
  if ! terraform -chdir="$INFRA_DIR" plan -input=false -out="$plan_file"; then
    rm -f "$plan_file"
    die "Terraform plan failed; local environment was not deployed"
  fi

  log "Applying the local Terraform plan..."
  if ! terraform -chdir="$INFRA_DIR" apply -input=false "$plan_file"; then
    rm -f "$plan_file"
    die "Terraform apply failed; check the Terraform and Kubernetes output"
  fi
  rm -f "$plan_file"
  ok "Terraform apply complete"
}

# ── load image into kind ──────────────────────────────────────────────────────
load_image() {
  log "Loading image into KinD cluster '$CLUSTER_NAME'..."
  kind load docker-image "$IMAGE_NAME" --name "$CLUSTER_NAME"
  ok "Image loaded into cluster"
}

# ── wait helpers ──────────────────────────────────────────────────────────────
wait_for_pod_ready() {
  local label="$1" timeout="${2:-180}"
  log "Waiting for pod (label=$label) to be ready (timeout=${timeout}s)..."
  kubectl wait pod \
    --namespace "$NAMESPACE" \
    --selector "$label" \
    --for=condition=Ready \
    --timeout="${timeout}s"
}

wait_for_postgres() {
  log "Waiting for PostgreSQL to accept connections..."
  local retries=30
  while [[ $retries -gt 0 ]]; do
    if kubectl exec -n "$NAMESPACE" \
        "$(kubectl get pod -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}')" \
        -- pg_isready -U postgres &>/dev/null 2>&1; then
      ok "PostgreSQL ready"
      return 0
    fi
    sleep 5
    retries=$((retries - 1))
  done
  die "PostgreSQL did not become ready in time"
}

# ── smoke test ────────────────────────────────────────────────────────────────
smoke_test() {
  local node_port
  node_port=$(kubectl get svc -n "$NAMESPACE" async-furious-service \
    -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "30000")
  local url="http://localhost:${node_port}/api/v1"
  log "Smoke test: GET $url"
  local status
  if ! status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url"); then
    status="000"
  fi
  if [[ "$status" == "200" ]]; then
    ok "App responding (HTTP $status)"
  else
    die "Smoke test failed: app returned HTTP $status — check logs: kubectl logs -n $NAMESPACE -l app=async-furious-api"
  fi
}

# ── teardown ──────────────────────────────────────────────────────────────────
teardown() {
  log "Destroying local environment..."
  if ! terraform -chdir="$INFRA_DIR" destroy -auto-approve -input=false; then
    warn "terraform destroy failed — state may be stale, will reset it after removing the kind cluster"
  fi

  if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    log "Deleting kind cluster '$CLUSTER_NAME'..."
    kind delete cluster --name "$CLUSTER_NAME"
  fi

  # A destroy against an already-gone cluster can leave terraform.tfstate
  # pointing at resources that no longer exist. The kind cluster is now gone
  # regardless (deleted above), so any leftover state is guaranteed stale —
  # wipe it so the next `up` starts from a clean slate instead of treating
  # phantom state entries as "already applied" against a brand-new cluster.
  rm -f "$INFRA_DIR"/terraform.tfstate "$INFRA_DIR"/terraform.tfstate.backup
  ok "Environment destroyed"
}

# ── main ──────────────────────────────────────────────────────────────────────
usage() {
  echo "Usage: $0 [up|down|reload]"
  echo "  up      Build image, provision cluster, deploy (default)"
  echo "  down    Destroy cluster via terraform destroy"
  echo "  reload  Rebuild image and reload into existing cluster"
  exit 1
}

CMD="${1:-up}"

case "$CMD" in
  up)
    check_prereqs
    load_secrets
    build_image
    terraform_init
    terraform_apply_cluster
    load_image
    terraform_apply_full
    wait_for_pod_ready "app=postgres" 180
    wait_for_postgres
    wait_for_pod_ready "app=async-furious-api" 300
    smoke_test
    ok "Local environment is UP → http://localhost:$(terraform -chdir="$INFRA_DIR" output -raw app_url 2>/dev/null | grep -oP '\d+$' || echo '30000')"
    ;;
  down)
    load_secrets
    teardown
    ;;
  reload)
    check_prereqs
    build_image
    load_image
    log "Restarting app deployment..."
    kubectl rollout restart deployment/async-furious-api -n "$NAMESPACE"
    wait_for_pod_ready "app=async-furious-api" 120
    smoke_test
    ok "Reload complete"
    ;;
  *)
    usage
    ;;
esac
