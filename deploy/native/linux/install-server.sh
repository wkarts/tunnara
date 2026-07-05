#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
node_major="$(node -p 'Number(process.versions.node.split(`.`)[0])' 2>/dev/null || echo 0)"
(( node_major >= 22 )) || { echo "Node.js 22 ou superior é obrigatório." >&2; exit 1; }
NODE_BIN="$(command -v node)"

id tunnara >/dev/null 2>&1 || useradd --system --home /var/lib/tunnara --create-home --shell /usr/sbin/nologin tunnara
install -d -o tunnara -g tunnara -m 0750 /var/lib/tunnara
install -d -o root -g root -m 0755 /opt/tunnara/runtime
rm -rf /opt/tunnara/runtime/node
cp -a "$ROOT_DIR/runtime/node" /opt/tunnara/runtime/node
chown -R root:root /opt/tunnara
install -d -m 0750 /etc/tunnara

if [[ ! -f /etc/tunnara/server.env ]]; then
  token="tnr_admin_$(openssl rand -base64 32 | tr -d '\n=/+' | head -c 43)"
  cat > /etc/tunnara/server.env <<ENV
NODE_NO_WARNINGS=1
TUNNARA_DATA_DIR=/var/lib/tunnara
TUNNARA_CONTROL_PORT=7100
TUNNARA_EDGE_PORT=7200
TUNNARA_RELAY_PORT=7300
TUNNARA_RELAY_EDGE_PORT=7301
TUNNARA_BASE_DOMAIN=tunnara.local
TUNNARA_PUBLIC_CONTROL_URL=http://127.0.0.1:7100
TUNNARA_PUBLIC_RELAY_URL=tcp://127.0.0.1:7300
TUNNARA_BOOTSTRAP_ORGANIZATION=Tunnara Community
TUNNARA_BOOTSTRAP_ADMIN_TOKEN=$token
TUNNARA_LOG_FORMAT=json
ENV
  chmod 0600 /etc/tunnara/server.env
  echo "Token administrativo inicial: $token"
fi

sed "s#^ExecStart=/usr/bin/node #ExecStart=${NODE_BIN} #" "$ROOT_DIR/deploy/native/linux/tunnara-server.service" > /etc/systemd/system/tunnara-server.service
chmod 0644 /etc/systemd/system/tunnara-server.service
ln -sf /opt/tunnara/runtime/node/bin/tunnara-server.mjs /usr/local/bin/tunnara-server
chmod +x /opt/tunnara/runtime/node/bin/*.mjs
systemctl daemon-reload
systemctl enable --now tunnara-server.service
systemctl --no-pager --full status tunnara-server.service || true
echo "Servidor instalado. Edite /etc/tunnara/server.env para anunciar IP/domínio público."
