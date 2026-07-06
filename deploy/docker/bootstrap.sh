#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-image}"
case "$MODE" in
  image) exec "$SCRIPT_DIR/tunnara.sh" quickstart ;;
  build) exec "$SCRIPT_DIR/tunnara.sh" quickstart-build ;;
  production) exec "$SCRIPT_DIR/tunnara.sh" up-production ;;
  *) echo "Uso: $0 image|build|production" >&2; exit 2 ;;
esac
