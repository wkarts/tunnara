#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/tunnara-console.pid"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/tunnara-console.log"
ENV_FILE="$APP_DIR/.env"
BIN_PATH="${TUNNARA_CONSOLE_BINARY:-$APP_DIR/bin/tunnara_console}"

mkdir -p "$LOG_DIR" "$APP_DIR/data"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Tunnara Console já está em execução. PID: $(cat "$PID_FILE")"
  exit 0
fi

if [[ ! -x "$BIN_PATH" ]]; then
  echo "Binário não encontrado ou sem permissão de execução: $BIN_PATH"
  echo "Execute: chmod +x $APP_DIR/bin/tunnara_console"
  exit 1
fi

set -a
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
set +a

export TUNNARA_CONSOLE_ENV_FILE="${TUNNARA_CONSOLE_ENV_FILE:-$ENV_FILE}"
export TUNNARA_CONSOLE_WEB_DIST_DIR="${TUNNARA_CONSOLE_WEB_DIST_DIR:-$APP_DIR/dist}"
export TUNNARA_CONSOLE_DATA_DIR="${TUNNARA_CONSOLE_DATA_DIR:-$APP_DIR/data}"
export TUNNARA_CONSOLE_LOGS_DIR="${TUNNARA_CONSOLE_LOGS_DIR:-$LOG_DIR}"
export TUNNARA_CONSOLE_API_HOST="${TUNNARA_CONSOLE_API_HOST:-127.0.0.1}"
export TUNNARA_CONSOLE_API_PORT="${TUNNARA_CONSOLE_API_PORT:-61001}"
export TUNNARA_CONSOLE_WEB_HOST="${TUNNARA_CONSOLE_WEB_HOST:-127.0.0.1}"
export TUNNARA_CONSOLE_WEB_PORT="${PORT:-${TUNNARA_CONSOLE_WEB_PORT:-61002}}"
export TUNNARA_CONSOLE_WEB_ENABLED="${TUNNARA_CONSOLE_WEB_ENABLED:-true}"
export TUNNARA_CONSOLE_WEB_AUTO_START="${TUNNARA_CONSOLE_WEB_AUTO_START:-true}"
export TUNNARA_CONSOLE_SERVICES_AUTO_START="${TUNNARA_CONSOLE_SERVICES_AUTO_START:-true}"

cd "$APP_DIR"
nohup "$BIN_PATH" \
  --mode=headless-api \
  --host "$TUNNARA_CONSOLE_API_HOST" \
  --port "$TUNNARA_CONSOLE_API_PORT" \
  --data-dir "$TUNNARA_CONSOLE_DATA_DIR" \
  --start-web-proxy \
  --start-services \
  >> "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
echo "Tunnara Console iniciado. PID: $(cat "$PID_FILE")"
echo "WebPort: http://$TUNNARA_CONSOLE_WEB_HOST:$TUNNARA_CONSOLE_WEB_PORT"
echo "API:     http://$TUNNARA_CONSOLE_API_HOST:$TUNNARA_CONSOLE_API_PORT"
echo "Logs:    $LOG_FILE"
