#!/usr/bin/env bash
set -Eeuo pipefail

WORKDIR="${1:-.}"
cd "$WORKDIR"

# Garante que lockfiles públicos não sejam contaminados por registries privados.
npm config set registry "${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"
npm config set audit false
npm config set fund false
npm config set prefer-offline true
npm config set fetch-retries 2
npm config set fetch-retry-factor 2
npm config set fetch-retry-mintimeout 1000
npm config set fetch-retry-maxtimeout 10000

run_install() {
  local log_file="$1"
  if npm ci --prefer-offline --no-audit --no-fund 2>&1 | tee "$log_file"; then
    return 0
  fi
  return "${PIPESTATUS[0]}"
}

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT

if run_install "$log_file"; then
  exit 0
fi

# Erros determinísticos não melhoram com retry e apenas atrasam o CI.
if grep -Eq 'ERESOLVE|EUSAGE|package-lock.json.*not in sync|Invalid package' "$log_file"; then
  echo 'npm ci falhou por inconsistência determinística de dependências/lockfile; retry cancelado.' >&2
  exit 1
fi

echo 'npm ci falhou por possível erro transitório; limpando metadados e tentando mais uma vez em 3s...' >&2
npm cache verify >/dev/null 2>&1 || true
sleep 3
npm ci --prefer-offline --no-audit --no-fund
