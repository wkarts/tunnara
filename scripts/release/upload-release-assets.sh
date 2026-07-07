#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
DIRECTORY="${2:-}"
RELEASE_ID_INPUT="${3:-${RELEASE_ID:-}}"
REPLACE_COMPLETE_ASSETS="${TUNNARA_RELEASE_ASSET_REPLACE:-0}"
MAX_UPLOAD_ATTEMPTS="${TUNNARA_RELEASE_UPLOAD_ATTEMPTS:-4}"
COLLISION_POLLS="${TUNNARA_RELEASE_COLLISION_POLLS:-30}"
POLL_SECONDS="${TUNNARA_RELEASE_POLL_SECONDS:-2}"

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
[[ "$MAX_UPLOAD_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || { echo "TUNNARA_RELEASE_UPLOAD_ATTEMPTS inválido." >&2; exit 2; }
[[ "$COLLISION_POLLS" =~ ^[1-9][0-9]*$ ]] || { echo "TUNNARA_RELEASE_COLLISION_POLLS inválido." >&2; exit 2; }
[[ "$POLL_SECONDS" =~ ^[0-9]+$ ]] || { echo "TUNNARA_RELEASE_POLL_SECONDS inválido." >&2; exit 2; }

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

# Retorna uma linha TSV por asset: id, state, size e digest.
# A paginação é explícita para funcionar de forma idêntica no gh Linux/macOS.
asset_records() {
  local asset_name="$1"
  local page=1
  local response count

  while :; do
    response="$(gh api "repos/$GITHUB_REPOSITORY/releases/$release_id/assets?per_page=100&page=$page")"
    count="$(printf '%s' "$response" | jq 'length')"
    printf '%s' "$response" | jq -r --arg name "$asset_name" '
      .[]
      | select(.name == $name)
      | [(.id | tostring), (.state // ""), ((.size // 0) | tostring), (.digest // "")]
      | @tsv
    '

    ((count < 100)) && break
    page=$((page + 1))
  done
}

asset_is_complete() {
  local asset_name="$1"
  local id state size digest

  while IFS=$'\t' read -r id state size digest; do
    [[ "$id" =~ ^[0-9]+$ ]] || continue
    if [[ "$state" == 'uploaded' && "$size" =~ ^[0-9]+$ && "$size" -gt 0 ]]; then
      printf '%s\t%s\t%s\t%s\n' "$id" "$state" "$size" "$digest"
      return 0
    fi
  done < <(asset_records "$asset_name")

  return 1
}

delete_asset_id() {
  local asset_id="$1"
  local asset_name="$2"
  echo "Removendo asset incompleto ou substituível: $asset_name (id=$asset_id)."
  gh api --method DELETE "repos/$GITHUB_REPOSITORY/releases/assets/$asset_id" >/dev/null
}

delete_assets_by_name() {
  local asset_name="$1"
  local include_complete="${2:-false}"
  local id state size digest
  local deleted=false

  while IFS=$'\t' read -r id state size digest; do
    [[ "$id" =~ ^[0-9]+$ ]] || continue
    if [[ "$include_complete" == true || "$state" != 'uploaded' || ! "$size" =~ ^[0-9]+$ || "$size" -eq 0 ]]; then
      delete_asset_id "$id" "$asset_name"
      deleted=true
    fi
  done < <(asset_records "$asset_name")

  [[ "$deleted" == true ]]
}

wait_until_absent() {
  local asset_name="$1"
  local poll=1
  local records

  while ((poll <= 15)); do
    records="$(asset_records "$asset_name")"
    [[ -z "$records" ]] && return 0
    sleep "$POLL_SECONDS"
    poll=$((poll + 1))
  done

  return 1
}

# Um HTTP 422 pode acontecer quando outro job/run está terminando o upload do
# mesmo nome. Nesse intervalo o nome já está reservado, mas o asset ainda pode
# não aparecer na listagem. Aguarda o asset ficar visível e aceita o resultado
# completo, pois a release é vinculada a um único source_sha imutável.
wait_for_concurrent_asset() {
  local asset_name="$1"
  local poll=1
  local complete

  while ((poll <= COLLISION_POLLS)); do
    if complete="$(asset_is_complete "$asset_name")"; then
      echo "Asset já concluído por outro job/run: $asset_name (${complete//$'\t'/, })."
      return 0
    fi

    # Remove somente uploads abandonados (state starter ou tamanho zero).
    delete_assets_by_name "$asset_name" false || true
    sleep "$POLL_SECONDS"
    poll=$((poll + 1))
  done

  return 1
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

  if [[ "$REPLACE_COMPLETE_ASSETS" != '1' ]]; then
    if complete="$(asset_is_complete "$asset_name")"; then
      echo "Asset completo já existe; upload idempotente ignorado: $asset_name (${complete//$'\t'/, })."
      continue
    fi
    delete_assets_by_name "$asset_name" false || true
  else
    if delete_assets_by_name "$asset_name" true; then
      wait_until_absent "$asset_name" || {
        echo "O asset $asset_name continuou visível após a exclusão." >&2
        exit 1
      }
    fi
  fi

  attempt=1
  while ((attempt <= MAX_UPLOAD_ATTEMPTS)); do
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

    if [[ "$http_code" == '422' ]] && jq -e '
      any(.errors[]?; .resource == "ReleaseAsset" and .code == "already_exists" and .field == "name")
    ' "$response_file" >/dev/null 2>&1; then
      echo "Colisão idempotente detectada para $asset_name; aguardando o upload concorrente." >&2
      if wait_for_concurrent_asset "$asset_name"; then
        uploaded=true
        break
      fi
    fi

    echo "Tentativa $attempt falhou ao enviar $asset_name (HTTP ${http_code:-indisponível})." >&2
    [[ -s "$response_file" ]] && cat "$response_file" >&2 || true

    # Antes de tentar novamente, elimina somente assets incompletos. Assets
    # completos são aceitos por wait_for_concurrent_asset e nunca apagados por
    # uma repetição tardia do mesmo workflow.
    delete_assets_by_name "$asset_name" false || true
    sleep $((attempt * 3))
    attempt=$((attempt + 1))
  done

  [[ "$uploaded" == true ]] || { echo "Falha definitiva ao enviar $file." >&2; exit 1; }
done
