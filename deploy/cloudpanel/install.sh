#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_DIR="${ROOT_DIR:-/home/tunnara/htdocs/tunnara}"
INSTALL_MODE="${INSTALL_MODE:-docker}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Execute como root para criar diretórios e serviços." >&2
  exit 1
fi

mkdir -p "$ROOT_DIR"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'target' \
  "$SOURCE_DIR/" "$ROOT_DIR/"

chown -R "${APP_USER:-tunnara}:${APP_GROUP:-tunnara}" "$ROOT_DIR" 2>/dev/null || true

echo "Tunnara copiado para $ROOT_DIR (modo $INSTALL_MODE)."

if [[ "$INSTALL_MODE" == "docker" ]]; then
  cd "$ROOT_DIR/deploy/docker"
  ./tunnara.sh up
  echo "Console disponível na porta definida por CONSOLE_PORT."
else
  echo "Instalação nativa preparada. Configure os units em deploy/systemd e o proxy do CloudPanel."
fi
