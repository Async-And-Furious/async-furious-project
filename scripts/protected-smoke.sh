#!/usr/bin/env bash
set -euo pipefail

: "${HML_BASE_URL:?HML_BASE_URL must be a real homologation endpoint}"
: "${HML_EMAIL:?HML_EMAIL is required}"
: "${HML_PASSWORD:?HML_PASSWORD is required}"
base_url="${HML_BASE_URL%/}"
correlation_id="release-smoke-${GITHUB_RUN_ID:-local}"
unauthorized_headers=$(mktemp)
login_headers=$(mktemp); login_body=$(mktemp)
authorized_headers=$(mktemp)
trap 'rm -f "$unauthorized_headers" "$login_headers" "$login_body" "$authorized_headers"' EXIT
request_body=$(jq -n --arg email "$HML_EMAIL" --arg password "$HML_PASSWORD" '{email: $email, password: $password}')
status=$(curl -sS -D "$unauthorized_headers" -o /dev/null -w '%{http_code}' -H "X-Correlation-ID: $correlation_id" "$base_url/api/v1/clientes")
test "$status" = 401 || { echo "Protected route returned $status instead of 401" >&2; exit 1; }
grep -qi "x-correlation-id: $correlation_id" "$unauthorized_headers" || { echo 'Unauthorized response missing correlation ID' >&2; exit 1; }
login_status=$(curl -sS -D "$login_headers" -o "$login_body" -w '%{http_code}' -H 'Content-Type: application/json' \
  -H "X-Correlation-ID: $correlation_id" \
  --data "$request_body" \
  "$base_url/api/v1/auth/login")
test "$login_status" = 200 || { echo "HML login returned $login_status instead of 200" >&2; exit 1; }
grep -qi "x-correlation-id: $correlation_id" "$login_headers" || { echo 'Missing correlation ID' >&2; exit 1; }
access_token=$(jq -er '.access_token // empty | select(type == "string" and length > 0)' "$login_body")
if [[ -z "$access_token" ]]; then
  echo 'HML login did not return a non-empty access token' >&2
  exit 1
fi
authorized_correlation_id="${correlation_id}-authorized"
authorized_status=$(curl -sS -D "$authorized_headers" -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $access_token" \
  -H "X-Correlation-ID: $authorized_correlation_id" \
  "$base_url/api/v1/clientes")
test "$authorized_status" = 200 || { echo "Authorized protected route returned $authorized_status instead of 200" >&2; exit 1; }
grep -qi "x-correlation-id: $authorized_correlation_id" "$authorized_headers" || { echo 'Authorized response missing correlation ID' >&2; exit 1; }
echo 'Protected HML smoke test passed.'
