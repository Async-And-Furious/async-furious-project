#!/usr/bin/env bash
# Runs the idempotent per-service database bootstrap as a Kubernetes Job inside
# the VPC (the RDS is private). The master credential is materialized in the
# namespace only while the Job runs and is removed on exit.
# Required env: K8S_NAMESPACE DB_HOST DB_PORT MASTER_SECRET_ARN RDS_SECRET_ARN
# BILLING_SECRET_ARN EXECUCAO_SECRET_ARN DB_NAME BILLING_DB_NAME EXECUCAO_DB_NAME
set -euo pipefail

dir=$(cd "$(dirname "$0")" && pwd)
run_id="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
job="db-bootstrap-${run_id}"
secret="db-bootstrap-credentials"
config="db-bootstrap-scripts"
image="${BOOTSTRAP_IMAGE:-public.ecr.aws/docker/library/postgres:16-alpine}"

cleanup() {
  kubectl delete secret "$secret" --namespace "$K8S_NAMESPACE" --ignore-not-found=true
  kubectl delete configmap "$config" --namespace "$K8S_NAMESPACE" --ignore-not-found=true
}
trap cleanup EXIT

field() { jq -er --arg f "$2" '.[$f] | select(. != null and . != "")' <<<"$1"; }
fetch() { aws secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text; }

master_json=$(fetch "$MASTER_SECRET_ARN")
os_json=$(fetch "$RDS_SECRET_ARN")
billing_json=$(fetch "$BILLING_SECRET_ARN")
execucao_json=$(fetch "$EXECUCAO_SECRET_ARN")

for value in "$(field "$master_json" password)" "$(field "$os_json" password)" \
  "$(field "$billing_json" password)" "$(field "$execucao_json" password)"; do
  printf '::add-mask::%s\n' "$value"
done

kubectl delete job --namespace "$K8S_NAMESPACE" --selector app.kubernetes.io/component=db-bootstrap --ignore-not-found=true --wait=true
kubectl create configmap "$config" --namespace "$K8S_NAMESPACE" \
  --from-file=bootstrap.sql="$dir/bootstrap.sql" \
  --from-file=verify-isolation.sh="$dir/verify-isolation.sh" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic "$secret" --namespace "$K8S_NAMESPACE" \
  --from-literal=MASTER_USER="$(field "$master_json" username)" \
  --from-literal=MASTER_PASSWORD="$(field "$master_json" password)" \
  --from-literal=OS_USER="$(field "$os_json" username)" \
  --from-literal=OS_PASSWORD="$(field "$os_json" password)" \
  --from-literal=BILLING_USER="$(field "$billing_json" username)" \
  --from-literal=BILLING_PASSWORD="$(field "$billing_json" password)" \
  --from-literal=EXECUCAO_USER="$(field "$execucao_json" username)" \
  --from-literal=EXECUCAO_PASSWORD="$(field "$execucao_json" password)" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f - <<MANIFEST
apiVersion: batch/v1
kind: Job
metadata:
  name: $job
  namespace: $K8S_NAMESPACE
  labels:
    app.kubernetes.io/part-of: async-furious
    app.kubernetes.io/component: db-bootstrap
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      containers:
        - name: bootstrap
          image: $image
          command:
            - sh
            - -c
            - |
              set -eu
              export PGHOST="\$DB_HOST" PGPORT="\$DB_PORT" PGUSER="\$MASTER_USER" PGPASSWORD="\$MASTER_PASSWORD" PGSSLMODE=require
              psql -d postgres -f /scripts/bootstrap.sql \
                -v os_user="\$OS_USER" -v os_password="\$OS_PASSWORD" -v os_db="\$OS_DB" \
                -v billing_user="\$BILLING_USER" -v billing_password="\$BILLING_PASSWORD" -v billing_db="\$BILLING_DB" \
                -v execucao_user="\$EXECUCAO_USER" -v execucao_password="\$EXECUCAO_PASSWORD" -v execucao_db="\$EXECUCAO_DB"
              unset PGPASSWORD
              sh /scripts/verify-isolation.sh
          env:
            - { name: DB_HOST, value: "$DB_HOST" }
            - { name: DB_PORT, value: "$DB_PORT" }
            - { name: OS_DB, value: "$DB_NAME" }
            - { name: BILLING_DB, value: "$BILLING_DB_NAME" }
            - { name: EXECUCAO_DB, value: "$EXECUCAO_DB_NAME" }
          envFrom:
            - secretRef:
                name: $secret
          volumeMounts:
            - { name: scripts, mountPath: /scripts, readOnly: true }
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { cpu: 200m, memory: 128Mi }
      volumes:
        - name: scripts
          configMap:
            name: $config
MANIFEST

kubectl wait --for=condition=complete "job/$job" --namespace "$K8S_NAMESPACE" --timeout=5m || {
  kubectl logs "job/$job" --namespace "$K8S_NAMESPACE" --all-containers=true --ignore-errors=true || true
  kubectl describe job "$job" --namespace "$K8S_NAMESPACE" || true
  kubectl describe pods --namespace "$K8S_NAMESPACE" --selector "job-name=$job" || true
  kubectl get events --namespace "$K8S_NAMESPACE" --sort-by='.metadata.creationTimestamp' || true
  exit 1
}
kubectl logs "job/$job" --namespace "$K8S_NAMESPACE" --all-containers=true
