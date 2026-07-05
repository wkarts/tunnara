#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Execute como root.' >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_BIN="${TUNNARA_SERVER_BINARY:-$PACKAGE_DIR/bin/tunnara-server}"
[[ -x "$SERVER_BIN" ]] || { echo "Binário não encontrado: $SERVER_BIN" >&2; exit 1; }
id tunnara >/dev/null 2>&1 || useradd --system --home /var/lib/tunnara --create-home --shell /usr/sbin/nologin tunnara
install -d -o tunnara -g tunnara -m 0750 /var/lib/tunnara
install -d -o root -g root -m 0750 /etc/tunnara
install -o root -g root -m 0755 "$SERVER_BIN" /usr/local/bin/tunnara-server
if [[ ! -f /etc/tunnara/server.env ]]; then
  token="tnr_admin_$(openssl rand -base64 32 | tr -d '\n=/+' | head -c 43)"
  cat > /etc/tunnara/server.env <<ENV
TUNNARA_DATA_DIR=/var/lib/tunnara
TUNNARA_CONTROL_HOST=0.0.0.0
TUNNARA_CONTROL_PORT=7100
TUNNARA_EDGE_HOST=0.0.0.0
TUNNARA_EDGE_PORT=7200
TUNNARA_RELAY_HOST=0.0.0.0
TUNNARA_RELAY_PORT=7300
TUNNARA_RELAY_EDGE_HOST=127.0.0.1
TUNNARA_RELAY_EDGE_PORT=7301
TUNNARA_BASE_DOMAIN=tunnara.local
TUNNARA_PUBLIC_SCHEME=http
TUNNARA_PUBLIC_CONTROL_URL=http://127.0.0.1:7100
TUNNARA_PUBLIC_RELAY_URL=tcp://127.0.0.1:7300
TUNNARA_BOOTSTRAP_ORGANIZATION=Tunnara Community
TUNNARA_BOOTSTRAP_ADMIN_TOKEN=$token
TUNNARA_CORS_ORIGIN=http://localhost:7400
TUNNARA_LOG_FORMAT=json
ENV
  chmod 0600 /etc/tunnara/server.env
  echo "Token administrativo inicial: $token"
fi
install -o root -g root -m 0644 "$SCRIPT_DIR/tunnara-server.service" /etc/systemd/system/tunnara-server.service
systemctl daemon-reload
systemctl enable --now tunnara-server.service
systemctl --no-pager --full status tunnara-server.service || true
echo 'Servidor instalado. Edite /etc/tunnara/server.env antes de expor o serviço publicamente.'
