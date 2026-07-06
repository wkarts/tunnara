#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
shift || true
[[ -n "$TAG" ]] || { echo 'Uso: upload-release-assets.sh <tag> <arquivo...>' >&2; exit 2; }
(($# > 0)) || { echo 'Nenhum arquivo informado para upload.' >&2; exit 2; }
command -v gh >/dev/null 2>&1 || { echo 'GitHub CLI (gh) não encontrado.' >&2; exit 2; }
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY não configurado}"
: "${GH_TOKEN:?GH_TOKEN não configurado}"

gh release view "$TAG" --repo "$GITHUB_REPOSITORY" >/dev/null

for file in "$@"; do
  [[ -f "$file" ]] || { echo "Asset não encontrado: $file" >&2; exit 1; }
  name="$(basename "$file")"
  for attempt in 1 2 3 4; do
    echo "Upload $name (tentativa $attempt/4)"
    if gh release upload "$TAG" "$file" --repo "$GITHUB_REPOSITORY" --clobber; then
      break
    fi
    if [[ "$attempt" -eq 4 ]]; then
      echo "Falha definitiva ao publicar $name." >&2
      exit 1
    fi
    sleep $((attempt * 5))
  done
done
