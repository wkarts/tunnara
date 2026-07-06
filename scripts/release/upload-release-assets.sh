#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
DIRECTORY="${2:-}"
[[ -n "$TAG" && -n "$DIRECTORY" ]] || {
  echo "Uso: $0 <tag> <diretório>" >&2
  exit 2
}
[[ -d "$DIRECTORY" ]] || { echo "Diretório de artefatos inexistente: $DIRECTORY" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) não encontrado." >&2; exit 1; }
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY não configurado}"
: "${GH_TOKEN:?GH_TOKEN não configurado}"

files=()
while IFS= read -r file; do
  files+=("$file")
done < <(find "$DIRECTORY" -maxdepth 1 -type f -print | LC_ALL=C sort)

((${#files[@]} > 0)) || { echo "Nenhum arquivo para enviar em $DIRECTORY." >&2; exit 1; }

for file in "${files[@]}"; do
  uploaded=false
  for attempt in 1 2 3; do
    if gh release upload "$TAG" "$file" --repo "$GITHUB_REPOSITORY" --clobber; then
      uploaded=true
      break
    fi
    echo "Tentativa $attempt falhou ao enviar $(basename "$file")." >&2
    sleep $((attempt * 3))
  done
  [[ "$uploaded" == true ]] || { echo "Falha definitiva ao enviar $file." >&2; exit 1; }
done
