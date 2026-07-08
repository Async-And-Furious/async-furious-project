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
  # must match the lowercase variable names (db_password, jwt_secret) declared
  # in infra/environments/local/variables.tf — ALL_CAPS here would break it.
  if [[ -z "${TF_VAR_db_password:-}" ]]; then
    read -r -s -p "Enter DB password: " TF_VAR_db_password; echo
    export TF_VAR_db_password # NOSONAR
  fi
  if [[ -z "${TF_VAR_jwt_secret:-}" ]]; then
    read -r -s -p "Enter JWT secret:  " TF_VAR_jwt_secret; echo
    export TF_VAR_jwt_secret # NOSONAR
  fi
}

# ── docker build ──────────────────────────────────────────────────────────────
build_image() {
  log "Building Docker image $IMAGE_NAME..."
  docker build -t "$IMAGE_NAME" "$(dirname "$0")/.."
  ok "Image built"
}

# ── terraform ─────────────────────────────────────────────────────────────────
terraform_apply() {
  log "Running terraform init..."
  terraform -chdir="$INFRA_DIR" init -upgrade -input=false

  log "Running terraform apply..."
  terraform -chdir="$INFRA_DIR" apply -auto-approve -input=false
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
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
  if [[ "$status" == "200" ]]; then
    ok "App responding (HTTP $status)"
  else
    warn "App returned HTTP $status — check logs: kubectl logs -n $NAMESPACE -l app=async-furious-api"
  fi
}

# ── teardown ──────────────────────────────────────────────────────────────────
teardown() {
  log "Destroying local environment..."
  terraform -chdir="$INFRA_DIR" destroy -auto-approve -input=false
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
    terraform_apply
    load_image
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
