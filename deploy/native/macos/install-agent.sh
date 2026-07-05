#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" -eq 0 ]] || { echo "Execute com sudo." >&2; exit 1; }
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TOKEN="${TUNNARA_PROVISIONING_TOKEN:-${1:-}}"
CONTROL_URL="${TUNNARA_CONTROL_URL:-${2:-http://127.0.0.1:7100}}"
[[ -n "$TOKEN" ]] || { echo "Uso: sudo $0 TOKEN [CONTROL_URL]" >&2; exit 1; }
node_major="$(node -p 'Number(process.versions.node.split(`.`)[0])' 2>/dev/null || echo 0)"
(( node_major >= 22 )) || { echo "Node.js 22 ou superior é obrigatório." >&2; exit 1; }
NODE_BIN="$(command -v node)"
BASE="/Library/Application Support/Tunnara"
mkdir -p "$BASE/runtime" "$BASE/agent" /Library/Logs/Tunnara
rm -rf "$BASE/runtime/node"
cp -a "$ROOT_DIR/runtime/node" "$BASE/runtime/node"
chmod +x "$BASE/runtime/node/bin/"*.mjs
ln -sf "$BASE/runtime/node/bin/tunnara.mjs" /usr/local/bin/tunnara
node "$BASE/runtime/node/bin/tunnara.mjs" login --token "$TOKEN" --name "$(scutil --get ComputerName)" --control-url "$CONTROL_URL" --config-dir "$BASE/agent"
sed "s#<string>/usr/local/bin/node</string>#<string>${NODE_BIN}</string>#" "$ROOT_DIR/deploy/native/macos/com.wwsoftwares.tunnara.agent.plist" > /Library/LaunchDaemons/com.wwsoftwares.tunnara.agent.plist
chmod 0644 /Library/LaunchDaemons/com.wwsoftwares.tunnara.agent.plist
launchctl bootout system/com.wwsoftwares.tunnara.agent 2>/dev/null || true
launchctl bootstrap system /Library/LaunchDaemons/com.wwsoftwares.tunnara.agent.plist
echo "Tunnara Agent instalado como LaunchDaemon."
