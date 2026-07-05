#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TOKEN="${TUNNARA_PROVISIONING_TOKEN:-${1:-}}"
CONTROL_URL="${TUNNARA_CONTROL_URL:-${2:-http://127.0.0.1:7100}}"
RELAY_URL="${TUNNARA_RELAY_URL:-${3:-}}"
NAME="${TUNNARA_AGENT_NAME:-$(hostname)}"
node_major="$(node -p 'Number(process.versions.node.split(`.`)[0])' 2>/dev/null || echo 0)"
(( node_major >= 22 )) || { echo "Node.js 22 ou superior é obrigatório." >&2; exit 1; }
NODE_BIN="$(command -v node)"
[[ -n "$TOKEN" ]] || { echo "Uso: $0 TOKEN_PROVISIONAMENTO [CONTROL_URL] [RELAY_URL]" >&2; exit 1; }

id tunnara-agent >/dev/null 2>&1 || useradd --system --home /var/lib/tunnara-agent --create-home --shell /usr/sbin/nologin tunnara-agent
install -d -o tunnara-agent -g tunnara-agent -m 0700 /var/lib/tunnara-agent
install -d -o root -g root -m 0755 /opt/tunnara/runtime
rm -rf /opt/tunnara/runtime/node
cp -a "$ROOT_DIR/runtime/node" /opt/tunnara/runtime/node
chown -R root:root /opt/tunnara
chmod +x /opt/tunnara/runtime/node/bin/*.mjs
ln -sf /opt/tunnara/runtime/node/bin/tunnara.mjs /usr/local/bin/tunnara

login_args=(login --token "$TOKEN" --name "$NAME" --control-url "$CONTROL_URL" --config-dir /var/lib/tunnara-agent)
[[ -n "$RELAY_URL" ]] && login_args+=(--relay-url "$RELAY_URL")
runuser -u tunnara-agent -- node /opt/tunnara/runtime/node/bin/tunnara.mjs "${login_args[@]}"
sed "s#^ExecStart=/usr/bin/node #ExecStart=${NODE_BIN} #" "$ROOT_DIR/deploy/native/linux/tunnara-agent.service" > /etc/systemd/system/tunnara-agent.service
chmod 0644 /etc/systemd/system/tunnara-agent.service
systemctl daemon-reload
systemctl enable --now tunnara-agent.service
systemctl --no-pager --full status tunnara-agent.service || true
