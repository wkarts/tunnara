#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BASE_FILE="$SCRIPT_DIR/docker-compose.base.yml"

usage() {
  cat <<'TXT'
Uso:
  ./storage.sh init
  ./storage.sh up <sqlite|postgres|mysql> <memory|local|database|redis>
  ./storage.sh down <sqlite|postgres|mysql> <memory|local|database|redis>
  ./storage.sh status <sqlite|postgres|mysql> <memory|local|database|redis>
  ./storage.sh logs <sqlite|postgres|mysql> <memory|local|database|redis>
  ./storage.sh doctor

Exemplos:
  ./storage.sh up sqlite local
  ./storage.sh up sqlite memory
  ./storage.sh up postgres redis
  ./storage.sh up mysql database
TXT
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"; else python3 - "$1" <<'PY'
import secrets, sys
print(secrets.token_hex(int(sys.argv[1])))
PY
  fi
}

random_app_key() {
  if command -v openssl >/dev/null 2>&1; then
    printf 'base64:%s\n' "$(openssl rand -base64 32 | tr -d '\n')"
  else
    python3 - <<'PY'
import base64, secrets
print('base64:' + base64.b64encode(secrets.token_bytes(32)).decode())
PY
  fi
}

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local tmp="${ENV_FILE}.tmp"
    awk -v k="$key" -v v="$value" 'BEGIN{FS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

init() {
  [[ -f "$ENV_FILE" ]] || cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
  set_env APP_KEY "$(random_app_key)"
  set_env DB_PASSWORD "$(random_hex 24)"
  set_env MYSQL_ROOT_PASSWORD "$(random_hex 24)"
  set_env REDIS_PASSWORD "$(random_hex 24)"
  chmod 600 "$ENV_FILE"
  echo "Configuração criada em $ENV_FILE"
}

compose_args() {
  local database="$1" state="$2"
  case "$database" in
    sqlite|postgres|mysql) ;;
    *) echo "Banco inválido: $database" >&2; usage; exit 2 ;;
  esac
  case "$state" in
    memory)
      set_env CACHE_STORE array
      set_env SESSION_DRIVER array
      set_env QUEUE_CONNECTION sync
      ;;
    local)
      set_env CACHE_STORE file
      set_env SESSION_DRIVER file
      set_env QUEUE_CONNECTION sync
      ;;
    database)
      set_env CACHE_STORE database
      set_env SESSION_DRIVER database
      set_env QUEUE_CONNECTION database
      ;;
    redis)
      set_env CACHE_STORE redis
      set_env SESSION_DRIVER redis
      set_env QUEUE_CONNECTION redis
      ;;
    *) echo "Estado inválido: $state" >&2; usage; exit 2 ;;
  esac
  COMPOSE_FILES=(-f "$BASE_FILE" -f "$SCRIPT_DIR/docker-compose.${database}.yml")
  if [[ "$state" == redis ]]; then COMPOSE_FILES+=(-f "$SCRIPT_DIR/docker-compose.redis.yml"); fi
}

run_compose() {
  local database="$1" state="$2"; shift 2
  [[ -f "$ENV_FILE" ]] || init
  compose_args "$database" "$state"
  docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"
}

command="${1:-help}"
case "$command" in
  init) init ;;
  up|down|status|logs|restart|destroy)
    database="${2:-}"; state="${3:-}"
    case "$command" in
      up) run_compose "$database" "$state" up -d --build ;;
      down) run_compose "$database" "$state" down ;;
      status) run_compose "$database" "$state" ps ;;
      logs) run_compose "$database" "$state" logs -f --tail=200 ;;
      restart) run_compose "$database" "$state" restart ;;
      destroy) run_compose "$database" "$state" down --volumes --remove-orphans ;;
    esac
    ;;
  doctor)
    [[ -f "$ENV_FILE" ]] || init
    curl -fsS "http://127.0.0.1:${CONTROL_API_PORT:-8080}/api/v1/health"
    printf '\n'
    ;;
  *) usage ;;
esac
