#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="${TUNNARA_CONSOLE_BINARY:-$APP_DIR/bin/tunnara_console}"
set -a
[[ -f "$APP_DIR/.env" ]] && source "$APP_DIR/.env"
set +a
export TUNNARA_CONSOLE_ENV_FILE="${TUNNARA_CONSOLE_ENV_FILE:-$APP_DIR/.env}"
export TUNNARA_CONSOLE_DATA_DIR="${TUNNARA_CONSOLE_DATA_DIR:-$APP_DIR/data}"
"$BIN_PATH" --mode=worker --data-dir "$TUNNARA_CONSOLE_DATA_DIR" "$@"
