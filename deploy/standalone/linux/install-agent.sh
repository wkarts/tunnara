#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Execute como root.' >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENT_BIN="${TUNNARA_AGENT_BINARY:-$PACKAGE_DIR/bin/tunnara}"
TOKEN="${TUNNARA_PROVISIONING_TOKEN:-${1:-}}"
CONTROL_URL="${TUNNARA_CONTROL_URL:-${2:-http://127.0.0.1:7100}}"
RELAY_URL="${TUNNARA_RELAY_URL:-${3:-}}"
NAME="${TUNNARA_AGENT_NAME:-$(hostname)}"
[[ -x "$AGENT_BIN" ]] || { echo "Binário não encontrado: $AGENT_BIN" >&2; exit 1; }
[[ -n "$TOKEN" ]] || { echo "Uso: $0 TOKEN_PROVISIONAMENTO [CONTROL_URL] [RELAY_URL]" >&2; exit 1; }
id tunnara-agent >/dev/null 2>&1 || useradd --system --home /var/lib/tunnara-agent --create-home --shell /usr/sbin/nologin tunnara-agent
install -d -o tunnara-agent -g tunnara-agent -m 0700 /var/lib/tunnara-agent
install -o root -g root -m 0755 "$AGENT_BIN" /usr/local/bin/tunnara
args=(login --token "$TOKEN" --name "$NAME" --control-url "$CONTROL_URL" --config-dir /var/lib/tunnara-agent)
[[ -n "$RELAY_URL" ]] && args+=(--relay-url "$RELAY_URL")
runuser -u tunnara-agent -- /usr/local/bin/tunnara "${args[@]}"
install -o root -g root -m 0644 "$SCRIPT_DIR/tunnara-agent.service" /etc/systemd/system/tunnara-agent.service
systemctl daemon-reload
systemctl enable --now tunnara-agent.service
systemctl --no-pager --full status tunnara-agent.service || true
