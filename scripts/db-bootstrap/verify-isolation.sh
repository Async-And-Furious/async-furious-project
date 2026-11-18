#!/bin/sh
# Proves the isolation: each service role connects to its own database and is
# refused on the other two. Reads DB_HOST/DB_PORT and <SVC>_USER/_PASSWORD/_DB.
set -eu

try_connect() {
  PGPASSWORD="$2" PGSSLMODE=require PGCONNECT_TIMEOUT=10 \
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$1" -d "$3" -tAc 'SELECT 1' >/dev/null 2>&1
}

check() {
  user=$1 password=$2 own=$3
  shift 3
  try_connect "$user" "$password" "$own" || { echo "FAIL: $user cannot connect to its own database $own" >&2; exit 1; }
  for other in "$@"; do
    if try_connect "$user" "$password" "$other"; then
      echo "FAIL: $user connected to $other" >&2
      exit 1
    fi
    echo "ok: $user refused on $other"
  done
}

check "$OS_USER" "$OS_PASSWORD" "$OS_DB" "$BILLING_DB" "$EXECUCAO_DB"
check "$BILLING_USER" "$BILLING_PASSWORD" "$BILLING_DB" "$OS_DB" "$EXECUCAO_DB"
check "$EXECUCAO_USER" "$EXECUCAO_PASSWORD" "$EXECUCAO_DB" "$OS_DB" "$BILLING_DB"
echo 'isolation verified'
