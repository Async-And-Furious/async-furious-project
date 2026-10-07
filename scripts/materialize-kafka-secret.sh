#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${DEPLOY_ENV:?DEPLOY_ENV is required}"
: "${KAFKA_BOOTSTRAP_SERVERS:?KAFKA_BOOTSTRAP_SERVERS is required}"
secret_name="${KAFKA_SECRET_NAME:-tc3/kafka/$DEPLOY_ENV}"
secret_json=$(aws secretsmanager get-secret-value --secret-id "$secret_name" --query SecretString --output text)
username=$(jq -er '.username' <<<"$secret_json")
password=$(jq -er '.password' <<<"$secret_json")
[[ -n "$username" && -n "$password" ]] || { echo 'Kafka secret has empty credentials.' >&2; exit 1; }
printf '::add-mask::%s\n' "$username"
printf '::add-mask::%s\n' "$password"

kubectl create namespace kafka --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic kafka-sasl --namespace kafka \
  --from-literal=client-passwords="$password" \
  --from-literal=inter-broker-password="$password" \
  --from-literal=controller-password="$password" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic async-furious-kafka --namespace "${K8S_NAMESPACE:-async-furious}" \
  --from-literal=KAFKA_USERNAME="$username" \
  --from-literal=KAFKA_PASSWORD="$password" \
  --from-literal=KAFKA_BROKERS="$KAFKA_BOOTSTRAP_SERVERS" \
  --dry-run=client -o yaml | kubectl apply -f -
