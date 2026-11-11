#!/usr/bin/env bash
# Leva o endpoint público do EKS ao estado pedido e confere o resultado.
#
# Uso: eks_endpoint_update.sh open <cidr-do-runner>
#      eks_endpoint_update.sh restore <original.json> <cidr-do-runner>
# Ambiente: AWS_REGION, EKS_CLUSTER_NAME; EKS_ENDPOINT_TIMEOUT (segundos, padrão 1200) e
# EKS_ENDPOINT_POLL_SECONDS (intervalo entre consultas, padrão 10).
#
# O cálculo do valor fica em scripts/eks_endpoint_access.py. Este script repete o ciclo
#   espera o cluster ACTIVE -> describe-cluster -> calcula -> update-cluster-config -> espera o update
# até o cálculo sair vazio, que é a pós-condição: na abertura, o /32 do runner está na lista; na
# restauração, ele saiu (ou o acesso público está desligado).
#
# Por que o ciclo, e não um update só:
# - o OS, o Billing, o Execução e o CI do repo-k8s-infra mexem no mesmo endpoint, e o EKS não tem
#   compare-and-swap. Esperar o cluster ACTIVE antes de ler encurta a janela entre o describe e o
#   update; reler depois do update detecta quando outro update chegou no meio e refaz o cálculo;
# - um update ainda em andamento (por exemplo, a abertura deste run que estourou o prazo ou foi
#   cancelada) só aparece no describe depois de terminar; sem a espera, a restauração não veria o
#   /32 e o deixaria liberado;
# - ResourceInUseException (outro update em curso) só faz tentar de novo, sempre recalculando.
#
# Na restauração, cluster inexistente não é erro: não há o que restaurar.
set -euo pipefail

mode=${1:-}
case "$mode" in
  open)
    [[ $# -eq 2 ]] || { echo "uso: $0 open <cidr-do-runner>" >&2; exit 2; }
    cidr=$2
    ;;
  restore)
    [[ $# -eq 3 ]] || { echo "uso: $0 restore <original.json> <cidr-do-runner>" >&2; exit 2; }
    original=$2
    cidr=$3
    ;;
  *)
    echo "uso: $0 open <cidr-do-runner> | restore <original.json> <cidr-do-runner>" >&2
    exit 2
    ;;
esac

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
current=$(mktemp)
error_file=$(mktemp)
trap 'rm -f "$current" "$error_file"' EXIT
deadline=$((SECONDS + ${EKS_ENDPOINT_TIMEOUT:-1200}))
poll=${EKS_ENDPOINT_POLL_SECONDS:-10}
eks=(--region "$AWS_REGION" --name "$EKS_CLUSTER_NAME")

cluster_inexistente() {
  [[ "$mode" == restore ]] && grep -q ResourceNotFoundException "$error_file"
}

while true; do
  (( SECONDS < deadline )) || { echo "Prazo esgotado ao ajustar o endpoint do EKS ($mode $cidr)." >&2; exit 1; }

  # Erro aqui (cluster inexistente, por exemplo) aparece no describe logo abaixo.
  aws eks wait cluster-active "${eks[@]}" 2>/dev/null || true
  if ! aws eks describe-cluster "${eks[@]}" \
    --query 'cluster.resourcesVpcConfig.{endpointPrivateAccess:endpointPrivateAccess,endpointPublicAccess:endpointPublicAccess,publicAccessCidrs:publicAccessCidrs}' \
    --output json > "$current" 2>"$error_file"; then
    cluster_inexistente && { echo "Cluster $EKS_CLUSTER_NAME não existe; nada a restaurar."; exit 0; }
    cat "$error_file" >&2
    exit 1
  fi

  if [[ "$mode" == open ]]; then
    access=$(python3 "$script_dir/eks_endpoint_access.py" open "$current" "$cidr")
  else
    access=$(python3 "$script_dir/eks_endpoint_access.py" restore "$original" "$current" "$cidr")
  fi
  if [[ -z "$access" ]]; then
    echo "Endpoint do EKS conferido ($mode $cidr)."
    exit 0
  fi

  if ! update_id=$(aws eks update-cluster-config "${eks[@]}" --resources-vpc-config "$access" \
    --query 'update.id' --output text 2>"$error_file"); then
    cluster_inexistente && { echo "Cluster $EKS_CLUSTER_NAME não existe; nada a restaurar."; exit 0; }
    grep -q ResourceInUseException "$error_file" || { cat "$error_file" >&2; exit 1; }
    sleep "$poll"
    continue
  fi

  while true; do
    status=$(aws eks describe-update "${eks[@]}" --update-id "$update_id" --query 'update.status' --output text)
    case "$status" in
      Successful) break ;;
      Failed | Cancelled) echo "Update $update_id do endpoint do EKS terminou com $status." >&2; exit 1 ;;
    esac
    (( SECONDS < deadline )) || { echo "Prazo esgotado esperando o update $update_id." >&2; exit 1; }
    sleep "$poll"
  done
  # Volta ao início: relê e confere a pós-condição.
done
