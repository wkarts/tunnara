#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_DIR="${TUNNARA_INSTALL_DIR:-/opt/tunnara}"
CONSOLE_DIR="${TUNNARA_CONSOLE_DIR:-/home/tunnara/htdocs/console}"
NODE_BIN="${TUNNARA_NODE_BIN:-$(command -v node || true)}"
[[ -n "$NODE_BIN" ]] || { echo "Node.js 22 não encontrado." >&2; exit 1; }
major="$($NODE_BIN -p 'Number(process.versions.node.split(`.`)[0])')"
(( major >= 22 )) || { echo "Node.js 22 ou superior é obrigatório." >&2; exit 1; }

id tunnara >/dev/null 2>&1 || useradd --system --home /var/lib/tunnara --create-home --shell /usr/sbin/nologin tunnara
mkdir -p "$INSTALL_DIR/runtime" /var/lib/tunnara /etc/tunnara "$CONSOLE_DIR"
rm -rf "$INSTALL_DIR/runtime/node" "$CONSOLE_DIR"/*
cp -a "$ROOT_DIR/runtime/node" "$INSTALL_DIR/runtime/node"
cp -a "$ROOT_DIR/apps/console/dist/." "$CONSOLE_DIR/"
chown -R root:root "$INSTALL_DIR"
chown -R tunnara:tunnara /var/lib/tunnara
chmod +x "$INSTALL_DIR/runtime/node/bin/"*.mjs

if [[ ! -f /etc/tunnara/server.env ]]; then
  token="tnr_admin_$(openssl rand -base64 32 | tr -d '\n=/+' | head -c 43)"
  cat > /etc/tunnara/server.env <<ENV
NODE_NO_WARNINGS=1
TUNNARA_DATA_DIR=/var/lib/tunnara
TUNNARA_CONTROL_PORT=7100
TUNNARA_EDGE_PORT=7200
TUNNARA_RELAY_PORT=7300
TUNNARA_RELAY_EDGE_PORT=7301
TUNNARA_BASE_DOMAIN=${TUNNARA_BASE_DOMAIN:-tunnara.local}
TUNNARA_PUBLIC_CONTROL_URL=${TUNNARA_PUBLIC_CONTROL_URL:-http://127.0.0.1:7100}
TUNNARA_PUBLIC_RELAY_URL=${TUNNARA_PUBLIC_RELAY_URL:-tcp://127.0.0.1:7300}
TUNNARA_BOOTSTRAP_ORGANIZATION=${TUNNARA_ORGANIZATION:-Tunnara Community}
TUNNARA_BOOTSTRAP_ADMIN_TOKEN=$token
TUNNARA_LOG_FORMAT=json
ENV
  chmod 0600 /etc/tunnara/server.env
  echo "Token administrativo inicial: $token"
fi

sed "s|/usr/bin/node|$NODE_BIN|; s|/opt/tunnara|$INSTALL_DIR|g" "$ROOT_DIR/deploy/native/linux/tunnara-server.service" > /etc/systemd/system/tunnara-server.service
systemctl daemon-reload
systemctl enable --now tunnara-server
cat <<MSG
Tunnara 0.2 instalado.

Console estático: $CONSOLE_DIR
Control API local: http://127.0.0.1:7100
Edge local: http://127.0.0.1:7200
Relay: tcp://0.0.0.0:7300

No CloudPanel, configure o vhost do Console com o template:
  $ROOT_DIR/deploy/cloudpanel/nginx-console.conf
E configure um domínio/wildcard para o Edge com:
  $ROOT_DIR/deploy/cloudpanel/nginx-edge.conf
MSG
