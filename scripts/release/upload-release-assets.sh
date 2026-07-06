#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
ASSET_DIR="${2:-}"
REPOSITORY="${GITHUB_REPOSITORY:-}"
MAX_ATTEMPTS="${TUNNARA_RELEASE_UPLOAD_ATTEMPTS:-3}"

[[ -n "$TAG" ]] || { echo "Uso: $0 <tag> <diretorio-de-assets>" >&2; exit 2; }
[[ -n "$ASSET_DIR" ]] || { echo "Uso: $0 <tag> <diretorio-de-assets>" >&2; exit 2; }
[[ -n "$REPOSITORY" ]] || { echo "GITHUB_REPOSITORY não configurado." >&2; exit 2; }
[[ -d "$ASSET_DIR" ]] || { echo "Diretório de assets não encontrado: $ASSET_DIR" >&2; exit 2; }
command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) não encontrado." >&2; exit 2; }

assets=()
shopt -s nullglob
for asset in "$ASSET_DIR"/*; do
  [[ -f "$asset" ]] && assets+=("$asset")
done
shopt -u nullglob

((${#assets[@]} > 0)) || { echo "Nenhum asset encontrado em $ASSET_DIR." >&2; exit 1; }

gh release view "$TAG" --repo "$REPOSITORY" >/dev/null

for asset in "${assets[@]}"; do
  name="$(basename "$asset")"
  uploaded=false

  for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
    echo "Enviando $name para $TAG (tentativa $attempt/$MAX_ATTEMPTS)..."
    if gh release upload "$TAG" "$asset" --repo "$REPOSITORY" --clobber; then
      uploaded=true
      break
    fi

    if ((attempt < MAX_ATTEMPTS)); then
      sleep $((attempt * 2))
    fi
  done

  [[ "$uploaded" == true ]] || {
    echo "Falha ao enviar $name após $MAX_ATTEMPTS tentativas." >&2
    exit 1
  }
done

echo "${#assets[@]} asset(s) enviados para $TAG com substituição idempotente."
