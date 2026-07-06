#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
DIRECTORY="${2:-}"
RELEASE_ID_INPUT="${3:-${RELEASE_ID:-}}"

[[ -n "$TAG" && -n "$DIRECTORY" ]] || {
  echo "Uso: $0 <tag> <diretório> [release-id]" >&2
  exit 2
}
[[ -d "$DIRECTORY" ]] || { echo "Diretório de artefatos inexistente: $DIRECTORY" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) não encontrado." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq não encontrado." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl não encontrado." >&2; exit 1; }
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY não configurado}"
: "${GH_TOKEN:?GH_TOKEN não configurado}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
release_id="$(bash "$SCRIPT_DIR/resolve-release-id.sh" "$TAG" "$RELEASE_ID_INPUT")"
[[ "$release_id" =~ ^[0-9]+$ ]] || { echo "Não foi possível resolver a release de $TAG." >&2; exit 1; }

urlencode() {
  local value="$1"
  local output=''
  local index character hex

  for ((index = 0; index < ${#value}; index += 1)); do
    character="${value:index:1}"
    case "$character" in
      [a-zA-Z0-9.~_-]) output+="$character" ;;
      *)
        printf -v hex '%%%02X' "'$character"
        output+="$hex"
        ;;
    esac
  done

  printf '%s' "$output"
}

delete_existing_asset() {
  local asset_name="$1"
  local asset_id
  local asset_ids

  asset_ids="$({
    gh api --paginate "repos/$GITHUB_REPOSITORY/releases/$release_id/assets?per_page=100"
  } | jq -r --arg name "$asset_name" '.[] | select(.name == $name) | .id' 2>/dev/null || true)"

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

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

for file in "${files[@]}"; do
  asset_name="$(basename "$file")"
  encoded_name="$(urlencode "$asset_name")"
  upload_url="https://uploads.github.com/repos/$GITHUB_REPOSITORY/releases/$release_id/assets?name=$encoded_name"
  uploaded=false

  for attempt in 1 2 3; do
    delete_existing_asset "$asset_name"

    response_file="$temp_dir/upload-${attempt}.json"
    http_code=''
    if http_code="$(curl \
      --silent \
      --show-error \
      --output "$response_file" \
      --write-out '%{http_code}' \
      --request POST \
      --header "Authorization: Bearer $GH_TOKEN" \
      --header 'Accept: application/vnd.github+json' \
      --header 'X-GitHub-Api-Version: 2022-11-28' \
      --header 'Content-Type: application/octet-stream' \
      --data-binary "@$file" \
      "$upload_url")"; then
      if [[ "$http_code" == '201' ]] && jq -e '.id | numbers' "$response_file" >/dev/null 2>&1; then
        echo "Asset enviado: $asset_name (release_id=$release_id)."
        uploaded=true
        break
      fi
    fi

    echo "Tentativa $attempt falhou ao enviar $asset_name (HTTP ${http_code:-indisponível})." >&2
    [[ -s "$response_file" ]] && cat "$response_file" >&2 || true
    sleep $((attempt * 3))
  done

  [[ "$uploaded" == true ]] || { echo "Falha definitiva ao enviar $file." >&2; exit 1; }
done
