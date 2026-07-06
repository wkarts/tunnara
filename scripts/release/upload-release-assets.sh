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

release_id="$(gh api "repos/$GITHUB_REPOSITORY/releases/tags/$TAG" --jq .id)"
[[ "$release_id" =~ ^[0-9]+$ ]] || { echo "Não foi possível resolver a release de $TAG." >&2; exit 1; }

delete_existing_asset() {
  local asset_name="$1"
  local asset_id
  local asset_ids

  asset_ids="$(
    gh api "repos/$GITHUB_REPOSITORY/releases/$release_id/assets?per_page=100" \
      --paginate \
      --jq ".[] | select(.name == \"$asset_name\") | .id" 2>/dev/null || true
  )"

  while IFS= read -r asset_id; do
    [[ "$asset_id" =~ ^[0-9]+$ ]] || continue
    echo "Removendo asset existente antes da substituição: $asset_name (id=$asset_id)."
    gh api --method DELETE "repos/$GITHUB_REPOSITORY/releases/assets/$asset_id" >/dev/null
  done <<< "$asset_ids"
}

files=()
while IFS= read -r file; do
  files+=("$file")
done < <(find "$DIRECTORY" -maxdepth 1 -type f -print | LC_ALL=C sort)

((${#files[@]} > 0)) || { echo "Nenhum arquivo para enviar em $DIRECTORY." >&2; exit 1; }

for file in "${files[@]}"; do
  asset_name="$(basename "$file")"
  uploaded=false

  for attempt in 1 2 3; do
    delete_existing_asset "$asset_name"

    if gh release upload "$TAG" "$file" --repo "$GITHUB_REPOSITORY" --clobber; then
      uploaded=true
      break
    fi

    echo "Tentativa $attempt falhou ao enviar $asset_name." >&2
    sleep $((attempt * 3))
  done

  [[ "$uploaded" == true ]] || { echo "Falha definitiva ao enviar $file." >&2; exit 1; }
done
