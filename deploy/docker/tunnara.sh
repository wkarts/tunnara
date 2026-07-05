#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
CLOUDFLARE_FILE="$SCRIPT_DIR/docker-compose.cloudflare.yml"
HA_FILE="$SCRIPT_DIR/docker-compose.ha.yml"
QUIC_FILE="$SCRIPT_DIR/docker-compose.quic.yml"
ENV_FILE="$SCRIPT_DIR/.env"

random_admin_token() {
  if command -v openssl >/dev/null 2>&1; then
    printf 'tnr_admin_%s\n' "$(openssl rand -base64 32 | tr -d '\n=/+' | head -c 43)"
  else
    python3 - <<'PY'
import secrets
print('tnr_admin_' + secrets.token_urlsafe(32))
PY
  fi
}

random_cluster_token() {
  if command -v openssl >/dev/null 2>&1; then
    printf 'tnr_cluster_%s\n' "$(openssl rand -base64 36 | tr -d '\n=/+' | head -c 48)"
  else
    python3 - <<'PYI'
import secrets
print('tnr_cluster_' + secrets.token_urlsafe(36))
PYI
  fi
}

random_master_key() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32 | tr -d '\n'
  else
    python3 - <<'PY'
import base64, secrets
print(base64.b64encode(secrets.token_bytes(32)).decode())
PY
  fi
}

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

get_env() {
  local key="$1"
  grep "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2-
}

init() {
  [[ -f "$ENV_FILE" ]] || cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
  local token master cluster
  token="$(get_env TUNNARA_BOOTSTRAP_ADMIN_TOKEN)"
  master="$(get_env TUNNARA_MASTER_KEY_BASE64)"
  cluster="$(get_env TUNNARA_CLUSTER_TOKEN)"
  [[ "$token" == tnr_admin_* ]] || token="$(random_admin_token)"
  [[ -n "$master" ]] || master="$(random_master_key)"
  [[ "$cluster" == tnr_cluster_* ]] || cluster="$(random_cluster_token)"
  set_env TUNNARA_BOOTSTRAP_ADMIN_TOKEN "$token"
  set_env TUNNARA_MASTER_KEY_BASE64 "$master"
  set_env TUNNARA_CLUSTER_TOKEN "$cluster"
  chmod 600 "$ENV_FILE"
  echo "Ambiente criado em $ENV_FILE"
  echo "Token administrativo inicial: $token"
  echo "A chave mestra foi gerada no .env e não será exibida. Faça backup seguro desse arquivo."
}

compose_base() {
  [[ -f "$ENV_FILE" ]] || init
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose_cloudflare() {
  [[ -f "$ENV_FILE" ]] || init
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$CLOUDFLARE_FILE" "$@"
}

compose_full() {
  [[ -f "$ENV_FILE" ]] || init
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$CLOUDFLARE_FILE" -f "$QUIC_FILE" "$@"
}

compose_ha() {
  [[ -f "$ENV_FILE" ]] || init
  docker compose --env-file "$ENV_FILE" -f "$HA_FILE" "$@"
}

production_preflight() {
  command -v docker >/dev/null 2>&1 || { echo "Docker não instalado." >&2; exit 1; }
  docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 não disponível." >&2; exit 1; }
  require_cloudflare_env
  local key value
  for key in TUNNARA_BASE_DOMAIN CLOUDFLARE_ZONE_NAME TUNNARA_ACME_EMAIL CLOUDFLARE_API_TOKEN TUNNARA_CLOUDFLARE_EDGE_ADDRESS; do
    value="$(get_env "$key")"
    [[ -n "$value" && "$value" != "change-me" && "$value" != *example.com* ]] || {
      echo "Configure $key no arquivo .env antes do deploy de produção." >&2; exit 1;
    }
  done
  echo "Preflight concluído. Verifique externamente as portas 80/tcp, 443/tcp, 443/udp e ${TUNNARA_QUIC_PORT:-7443}/udp."
}

wait_control() {
  local port retries=90
  port="$(control_port)"
  until curl -fsS "http://127.0.0.1:${port}/healthz" >/dev/null 2>&1; do
    retries=$((retries - 1)); [[ $retries -gt 0 ]] || { echo "Control API não ficou saudável." >&2; return 1; }
    sleep 2
  done
}

require_cloudflare_env() {
  local missing=0 key
  for key in TUNNARA_BASE_DOMAIN TUNNARA_ACME_EMAIL CLOUDFLARE_API_TOKEN; do
    if [[ -z "$(get_env "$key")" ]]; then
      echo "Variável obrigatória ausente no .env: $key" >&2
      missing=1
    fi
  done
  [[ $missing -eq 0 ]] || exit 1
}

admin_token() { get_env TUNNARA_BOOTSTRAP_ADMIN_TOKEN; }
control_port() { local p; p="$(get_env CONTROL_PORT)"; printf '%s' "${p:-7100}"; }

api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-fsS -X "$method" "http://127.0.0.1:$(control_port)$path" -H "Authorization: Bearer $(admin_token)" -H 'Accept: application/json')
  if [[ -n "$body" ]]; then args+=(-H 'Content-Type: application/json' -d "$body"); fi
  curl "${args[@]}"
}

json_pretty() { if command -v jq >/dev/null 2>&1; then jq .; else cat; fi; }

cloudflare_configure() {
  require_cloudflare_env
  local zone="$(get_env CLOUDFLARE_ZONE_ID)" zone_name base email token
  zone_name="$(get_env CLOUDFLARE_ZONE_NAME)"; base="$(get_env TUNNARA_BASE_DOMAIN)"; email="$(get_env TUNNARA_ACME_EMAIL)"; token="$(get_env CLOUDFLARE_API_TOKEN)"
  api PUT /api/v1/integrations/cloudflare "{\"apiToken\":\"$token\",\"zoneId\":\"$zone\",\"zoneName\":\"${zone_name:-$base}\",\"managedDomain\":\"$base\",\"acmeEmail\":\"$email\",\"proxied\":false}" | json_pretty
}

case "${1:-help}" in
  init) init ;;
  up) compose_base up -d --build ;;
  up-cloudflare)
    require_cloudflare_env
    compose_cloudflare up -d --build
    echo "Após o health check, execute: ./tunnara.sh cloudflare-configure && ./tunnara.sh cloudflare-bootstrap"
    ;;
  preflight) production_preflight ;;
  up-production)
    production_preflight
    compose_full up -d --build
    wait_control
    cloudflare_configure
    api POST /api/v1/integrations/cloudflare/test '{}' | json_pretty
    api POST /api/v1/integrations/cloudflare/bootstrap-dns '{}' | json_pretty
    echo "Tunnara produção iniciada com Cloudflare, Let's Encrypt, HTTP/3 e QUIC."
    ;;
  down-production) compose_full down ;;
  status-production) compose_full ps ;;
  logs-production) shift; compose_full logs -f --tail=200 "$@" ;;
  destroy-production) compose_full down --volumes --remove-orphans ;;
  up-cloudflare-tunnel)
    require_cloudflare_env
    [[ -n "$(get_env CLOUDFLARED_TUNNEL_TOKEN)" ]] || { echo "CLOUDFLARED_TUNNEL_TOKEN ausente." >&2; exit 1; }
    compose_cloudflare --profile cloudflare-tunnel up -d --build
    ;;
  down) compose_base down ;;
  up-ha) require_cloudflare_env; [[ -n "$(get_env TUNNARA_PUBLIC_HOST)" ]] || { echo "TUNNARA_PUBLIC_HOST ausente." >&2; exit 1; }; compose_ha up -d --build ;;
  down-ha) compose_ha down ;;
  restart-ha) compose_ha restart ;;
  status-ha) compose_ha ps ;;
  logs-ha) shift; compose_ha logs -f --tail=200 "$@" ;;
  destroy-ha) compose_ha down --volumes --remove-orphans ;;
  down-cloudflare) compose_cloudflare down ;;
  restart) compose_base restart ;;
  restart-cloudflare) compose_cloudflare restart ;;
  destroy) compose_base down --volumes --remove-orphans ;;
  destroy-cloudflare) compose_cloudflare down --volumes --remove-orphans ;;
  status) compose_base ps ;;
  status-cloudflare) compose_cloudflare ps ;;
  logs) shift; compose_base logs -f --tail=200 "$@" ;;
  logs-cloudflare) shift; compose_cloudflare logs -f --tail=200 "$@" ;;
  token) admin_token ;;
  provision)
    shift || true
    api POST /api/v1/provisioning-tokens "{\"name\":\"${1:-Novo agente}\",\"ttlSeconds\":900}" | json_pretty
    ;;
  cloudflare-configure) cloudflare_configure ;;
  cloudflare-test) api POST /api/v1/integrations/cloudflare/test '{}' | json_pretty ;;
  cloudflare-bootstrap) api POST /api/v1/integrations/cloudflare/bootstrap-dns '{}' | json_pretty ;;
  cloudflare-status) api GET /api/v1/integrations | json_pretty ;;
  backup)
    destination="${2:-$SCRIPT_DIR/backups/tunnara-$(date +%Y%m%d-%H%M%S).sqlite}"
    container_file="/var/lib/tunnara/tunnara-backup-export.sqlite"
    mkdir -p "$(dirname "$destination")"
    compose_base exec -T tunnara-server node /opt/tunnara/runtime/node/bin/tunnara-server.mjs backup --data-dir /var/lib/tunnara --output "$container_file" >/dev/null
    compose_base cp "tunnara-server:$container_file" "$destination"
    compose_base exec -T tunnara-server rm -f "$container_file"
    chmod 600 "$destination" 2>/dev/null || true
    echo "Backup SQLite consistente criado: $destination"
    ;;
  restore)
    source_file="${2:-}"
    [[ -f "$source_file" ]] || { echo "Uso: ./tunnara.sh restore ARQUIVO.sqlite" >&2; exit 1; }
    source_file="$(cd "$(dirname "$source_file")" && pwd)/$(basename "$source_file")"
    compose_base stop tunnara-server
    compose_base run --rm --no-deps -v "$source_file:/restore.sqlite:ro" tunnara-server restore --data-dir /var/lib/tunnara --input /restore.sqlite --force
    compose_base up -d tunnara-server
    echo "Backup restaurado: $source_file"
    ;;
  *)
    cat <<'USAGE'
Uso: ./tunnara.sh <comando>

Stack básica:
  init                     cria .env, token administrativo e chave mestra
  up|down|restart          gerencia a stack sem TLS externo
  status|logs [serviço]    estado e logs
  destroy                  remove containers e volumes

Produção completa:
  preflight                valida ambiente, domínio, token e Docker
  up-production            sobe Cloudflare + Let's Encrypt + HTTP/3 + QUIC
  down-production          encerra a stack completa
  status-production        mostra a stack completa
  logs-production          acompanha os logs
  destroy-production       remove containers e volumes

Cloudflare + Let's Encrypt:
  up-cloudflare            inicia Tunnara + Caddy DNS-01/HTTP3
  up-cloudflare-tunnel     inclui Cloudflare Tunnel usando QUIC
  up-ha                    sobe 2 Controls, 2 Relays, 2 Edges e Caddy/HTTP3
  down-ha|restart-ha       gerencia a stack HA
  status-ha|logs-ha        estado e logs da stack HA
  destroy-ha               remove a stack HA e seus volumes
  down-cloudflare          encerra a stack Cloudflare
  status-cloudflare        mostra os containers da stack
  logs-cloudflare          acompanha os logs da stack
  cloudflare-configure     grava token/zone criptografados no Control API
  cloudflare-test          valida token e zona
  cloudflare-bootstrap     cria registros base, wildcard, control, console e relay
  cloudflare-status        lista integrações configuradas

Operação:
  token                    exibe o token bootstrap do .env
  provision [nome]         gera token de uso único para Agent
  backup [arquivo]         cria backup SQLite consistente
  restore arquivo          restaura backup com reinício controlado
USAGE
    ;;
esac
