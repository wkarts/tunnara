#!/usr/bin/env bash
set -Eeuo pipefail

WORKDIR="${1:-.}"
cd "$WORKDIR"

# Evita que URLs de registry privadas gravadas por ambientes de desenvolvimento
# contaminem o CI público. O package-lock deve continuar determinístico.
npm config set registry "${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"
npm config set audit false
npm config set fund false
npm config set prefer-offline true
npm config set fetch-retries 4
npm config set fetch-retry-factor 2
npm config set fetch-retry-mintimeout 1000
npm config set fetch-retry-maxtimeout 15000

attempt=1
max_attempts=3
until npm ci --prefer-offline --no-audit --no-fund; do
  if (( attempt >= max_attempts )); then
    echo "npm ci falhou após ${max_attempts} tentativas." >&2
    exit 1
  fi
  delay=$((attempt * 5))
  echo "npm ci falhou na tentativa ${attempt}; nova tentativa em ${delay}s..." >&2
  npm cache verify >/dev/null 2>&1 || true
  sleep "$delay"
  attempt=$((attempt + 1))
done
