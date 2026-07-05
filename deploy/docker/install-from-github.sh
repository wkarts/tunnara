#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY="${TUNNARA_GITHUB_REPOSITORY:-wkarts/tunnara}"
INSTALL_DIR="${TUNNARA_INSTALL_DIR:-/opt/tunnara}"
REQUESTED_VERSION="${TUNNARA_VERSION:-latest}"
START_MODE="${TUNNARA_START_MODE:-image}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

info() { printf '[Tunnara Installer] %s\n' "$*"; }
die() { printf '[Tunnara Installer] ERRO: %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die 'curl não está instalado.'
command -v unzip >/dev/null 2>&1 || die 'unzip não está instalado.'
command -v docker >/dev/null 2>&1 || die 'Docker Engine não está instalado.'
docker compose version >/dev/null 2>&1 || die 'Docker Compose v2 não está disponível.'

headers=(-H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28')
if [[ -n "${GITHUB_TOKEN:-}" ]]; then headers+=(-H "Authorization: Bearer $GITHUB_TOKEN"); fi

if [[ "$REQUESTED_VERSION" == latest ]]; then
  api_url="https://api.github.com/repos/$REPOSITORY/releases/latest"
else
  tag="$REQUESTED_VERSION"
  [[ "$tag" == v* ]] || tag="v$tag"
  api_url="https://api.github.com/repos/$REPOSITORY/releases/tags/$tag"
fi

info "Consultando release em $REPOSITORY..."
release_json="$TMP_DIR/release.json"
curl -fsSL "${headers[@]}" "$api_url" -o "$release_json"

python3 - "$release_json" "$TMP_DIR/asset-url" <<'PY'
import json, pathlib, sys
release = json.loads(pathlib.Path(sys.argv[1]).read_text())
tag = release['tag_name']
expected = f'Tunnara-Docker-{tag}.zip'
for asset in release.get('assets', []):
    if asset.get('name') == expected:
        pathlib.Path(sys.argv[2]).write_text(asset['url'])
        pathlib.Path(sys.argv[2] + '.name').write_text(expected)
        pathlib.Path(sys.argv[2] + '.tag').write_text(tag)
        break
else:
    raise SystemExit(f'Asset ausente na release: {expected}')
PY

asset_url="$(cat "$TMP_DIR/asset-url")"
asset_name="$(cat "$TMP_DIR/asset-url.name")"
tag="$(cat "$TMP_DIR/asset-url.tag")"
info "Baixando $asset_name..."
curl -fsSL "${headers[@]}" -H 'Accept: application/octet-stream' "$asset_url" -o "$TMP_DIR/$asset_name"
unzip -q "$TMP_DIR/$asset_name" -d "$TMP_DIR/unpacked"
source_dir="$(find "$TMP_DIR/unpacked" -mindepth 1 -maxdepth 1 -type d | head -1)"
[[ -n "$source_dir" ]] || die 'Pacote Docker inválido.'

sudo_cmd=()
if [[ "$(id -u)" -ne 0 ]]; then
  command -v sudo >/dev/null 2>&1 || die 'Execute como root ou instale sudo.'
  sudo_cmd=(sudo)
fi

existing_env=''
if [[ -f "$INSTALL_DIR/deploy/docker/.env" ]]; then
  existing_env="$TMP_DIR/tunnara.env"
  "${sudo_cmd[@]}" cp "$INSTALL_DIR/deploy/docker/.env" "$existing_env"
  "${sudo_cmd[@]}" chown "$(id -u):$(id -g)" "$existing_env" 2>/dev/null || true
fi

"${sudo_cmd[@]}" mkdir -p "$(dirname "$INSTALL_DIR")"
"${sudo_cmd[@]}" rm -rf "$INSTALL_DIR.new"
"${sudo_cmd[@]}" mkdir -p "$INSTALL_DIR.new"
"${sudo_cmd[@]}" cp -a "$source_dir"/. "$INSTALL_DIR.new"/
if [[ -n "$existing_env" ]]; then
  "${sudo_cmd[@]}" cp "$existing_env" "$INSTALL_DIR.new/deploy/docker/.env"
fi
"${sudo_cmd[@]}" rm -rf "$INSTALL_DIR.old"
if [[ -d "$INSTALL_DIR" ]]; then
  "${sudo_cmd[@]}" mv "$INSTALL_DIR" "$INSTALL_DIR.old"
fi
"${sudo_cmd[@]}" mv "$INSTALL_DIR.new" "$INSTALL_DIR"
"${sudo_cmd[@]}" chown -R "$(id -u):$(id -g)" "$INSTALL_DIR" 2>/dev/null || true

info "Tunnara $tag instalada em $INSTALL_DIR"
cd "$INSTALL_DIR/deploy/docker"
./tunnara.sh init
case "$START_MODE" in
  none) info 'Inicialização automática desabilitada.' ;;
  image) ./tunnara.sh quickstart ;;
  build) ./tunnara.sh quickstart-build ;;
  production) ./tunnara.sh up-production ;;
  *) die "TUNNARA_START_MODE inválido: $START_MODE" ;;
esac
