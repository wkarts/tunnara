#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BASE_FILE="$SCRIPT_DIR/docker-compose.yml"
BASE_BUILD_FILE="$SCRIPT_DIR/docker-compose.build.yml"
CLOUDFLARE_FILE="$SCRIPT_DIR/docker-compose.cloudflare.yml"
CLOUDFLARE_BUILD_FILE="$SCRIPT_DIR/docker-compose.cloudflare.build.yml"
QUIC_FILE="$SCRIPT_DIR/docker-compose.quic.yml"
QUIC_BUILD_FILE="$SCRIPT_DIR/docker-compose.quic.build.yml"
HA_FILE="$SCRIPT_DIR/docker-compose.ha.yml"
HA_BUILD_FILE="$SCRIPT_DIR/docker-compose.ha.build.yml"
OBSERVABILITY_FILE="$SCRIPT_DIR/docker-compose.observability.yml"
DISTRIBUTED_FILE="$SCRIPT_DIR/docker-compose.distributed.yml"
DISTRIBUTED_QUIC_FILE="$SCRIPT_DIR/docker-compose.distributed.quic.yml"

info() { printf '[Tunnara] %s\n' "$*"; }
warn() { printf '[Tunnara] AVISO: %s\n' "$*" >&2; }
die() { printf '[Tunnara] ERRO: %s\n' "$*" >&2; exit 1; }

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
    python3 - <<'PY'
import secrets
print('tnr_cluster_' + secrets.token_urlsafe(36))
PY
  fi
}

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 30 | tr -d '\n=/+' | head -c 32
  else
    python3 - <<'PY2'
import secrets
print(secrets.token_urlsafe(24))
PY2
  fi
}

random_app_key() {
  if command -v openssl >/dev/null 2>&1; then
    printf 'base64:%s
' "$(openssl rand -base64 32 | tr -d '\n')"
  else
    python3 - <<'PYAPP'
import base64, secrets
print('base64:' + base64.b64encode(secrets.token_bytes(32)).decode())
PYAPP
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
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local escaped
    escaped="$(printf '%s' "$value" | sed 's/[&|]/\\&/g')"
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
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

  local token master cluster grafana_password app_key db_password redis_password
  token="$(get_env TUNNARA_BOOTSTRAP_ADMIN_TOKEN)"
  master="$(get_env TUNNARA_MASTER_KEY_BASE64)"
  cluster="$(get_env TUNNARA_CLUSTER_TOKEN)"
  grafana_password="$(get_env GRAFANA_ADMIN_PASSWORD)"
  app_key="$(get_env APP_KEY)"
  db_password="$(get_env DB_PASSWORD)"
  redis_password="$(get_env REDIS_PASSWORD)"

  [[ "$token" =~ ^tnr_admin_[A-Za-z0-9_-]{32,}$ && "$token" != *change* && "$token" != *example* ]] || token="$(random_admin_token)"
  [[ -n "$master" && "$master" != change-me && "$master" != change_me ]] || master="$(random_master_key)"
  [[ "$cluster" =~ ^tnr_cluster_[A-Za-z0-9_-]{40,}$ && "$cluster" != *change* && "$cluster" != *example* ]] || cluster="$(random_cluster_token)"
  [[ -n "$grafana_password" && "$grafana_password" != change_me ]] || grafana_password="$(random_password)"
  [[ "$app_key" == base64:* ]] || app_key="$(random_app_key)"
  [[ -n "$db_password" && "$db_password" != change_me ]] || db_password="$(random_password)"
  [[ -n "$redis_password" && "$redis_password" != change_me ]] || redis_password="$(random_password)"

  set_env TUNNARA_BOOTSTRAP_ADMIN_TOKEN "$token"
  set_env TUNNARA_MASTER_KEY_BASE64 "$master"
  set_env TUNNARA_CLUSTER_TOKEN "$cluster"
  set_env GRAFANA_ADMIN_PASSWORD "$grafana_password"
  set_env APP_KEY "$app_key"
  set_env DB_PASSWORD "$db_password"
  set_env REDIS_PASSWORD "$redis_password"
  chmod 600 "$ENV_FILE"

  info "Ambiente criado/atualizado em $ENV_FILE"
  info "Token administrativo inicial: $token"
  info 'A chave mestra e o cluster token foram gravados no .env. Faça backup seguro.'
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die 'Docker Engine não está instalado.'
  docker compose version >/dev/null 2>&1 || die 'Docker Compose v2 não está disponível.'
  docker info >/dev/null 2>&1 || die 'O daemon Docker não está acessível para o usuário atual.'
}

deploy_mode() {
  local mode
  mode="$(get_env TUNNARA_DEPLOY_MODE)"
  case "${mode:-image}" in
    image|build) printf '%s' "${mode:-image}" ;;
    *) die "TUNNARA_DEPLOY_MODE inválido: $mode. Use image ou build." ;;
  esac
}

compose_run() {
  local stack="$1"; shift
  [[ -f "$ENV_FILE" ]] || init
  require_docker

  local -a files
  case "$stack" in
    base)
      files=(-f "$BASE_FILE")
      if [[ "$(deploy_mode)" == build ]]; then files+=(-f "$BASE_BUILD_FILE"); fi
      ;;
    cloudflare)
      files=(-f "$BASE_FILE" -f "$CLOUDFLARE_FILE")
      if [[ "$(deploy_mode)" == build ]]; then files+=(-f "$BASE_BUILD_FILE" -f "$CLOUDFLARE_BUILD_FILE"); fi
      ;;
    full)
      files=(-f "$BASE_FILE" -f "$CLOUDFLARE_FILE" -f "$QUIC_FILE")
      if [[ "$(deploy_mode)" == build ]]; then
        files+=(-f "$BASE_BUILD_FILE" -f "$CLOUDFLARE_BUILD_FILE" -f "$QUIC_BUILD_FILE")
      fi
      ;;
    ha)
      files=(-f "$HA_FILE")
      if [[ "$(deploy_mode)" == build ]]; then files+=(-f "$HA_BUILD_FILE"); fi
      ;;
    observability)
      files=(-f "$BASE_FILE" -f "$OBSERVABILITY_FILE")
      if [[ "$(deploy_mode)" == build ]]; then files+=(-f "$BASE_BUILD_FILE"); fi
      ;;
    distributed)
      files=(-f "$DISTRIBUTED_FILE")
      ;;
    distributed-quic)
      files=(-f "$DISTRIBUTED_FILE" -f "$DISTRIBUTED_QUIC_FILE")
      ;;
    *) die "Stack Docker desconhecida: $stack" ;;
  esac

  docker compose --env-file "$ENV_FILE" "${files[@]}" "$@"
}

compose_base() { compose_run base "$@"; }
compose_cloudflare() { compose_run cloudflare "$@"; }
compose_full() { compose_run full "$@"; }
compose_ha() { compose_run ha "$@"; }
compose_observability() { compose_run observability "$@"; }
compose_distributed() { compose_run distributed "$@"; }
compose_distributed_quic() { compose_run distributed-quic "$@"; }

start_stack() {
  local stack="$1"; shift || true
  local mode
  mode="$(deploy_mode)"
  if [[ "$mode" == image ]]; then
    info 'Baixando imagens publicadas no GHCR...'
    compose_run "$stack" pull
    compose_run "$stack" up -d --remove-orphans "$@"
  else
    info 'Construindo imagens localmente a partir do código-fonte...'
    compose_run "$stack" up -d --build --remove-orphans "$@"
  fi
}

control_port() { local p; p="$(get_env CONTROL_PORT)"; printf '%s' "${p:-7100}"; }
console_port() { local p; p="$(get_env CONSOLE_PORT)"; printf '%s' "${p:-7400}"; }
edge_port() { local p; p="$(get_env EDGE_PORT)"; printf '%s' "${p:-8080}"; }
admin_token() { get_env TUNNARA_BOOTSTRAP_ADMIN_TOKEN; }

wait_url() {
  local url="$1" label="$2" retries="${3:-90}"
  until curl -fsS "$url" >/dev/null 2>&1; do
    retries=$((retries - 1))
    [[ $retries -gt 0 ]] || die "$label não ficou saudável: $url"
    sleep 2
  done
}

wait_control() { wait_url "http://127.0.0.1:$(control_port)/healthz" 'Control API'; }

api() {
  local method="$1" path="$2" body="${3:-}"
  local -a args=(-fsS -X "$method" "http://127.0.0.1:$(control_port)$path" -H "Authorization: Bearer $(admin_token)" -H 'Accept: application/json')
  if [[ -n "$body" ]]; then args+=(-H 'Content-Type: application/json' -d "$body"); fi
  curl "${args[@]}"
}

json_pretty() { if command -v jq >/dev/null 2>&1; then jq .; else cat; fi; }

is_placeholder() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == change-me || "$value" == *example.com* || "$value" == 203.0.113.* ]]
}

require_cloudflare_env() {
  local key value missing=0
  for key in TUNNARA_BASE_DOMAIN CLOUDFLARE_ZONE_NAME TUNNARA_ACME_EMAIL CLOUDFLARE_API_TOKEN TUNNARA_CLOUDFLARE_EDGE_ADDRESS; do
    value="$(get_env "$key")"
    if is_placeholder "$value"; then
      echo "Configure $key no arquivo $ENV_FILE." >&2
      missing=1
    fi
  done
  [[ $missing -eq 0 ]] || exit 1
}

check_port_available() {
  local port="$1" protocol="$2" flag
  [[ "$protocol" == udp ]] && flag=u || flag=t
  if command -v ss >/dev/null 2>&1 && ss -H -l"${flag}"n 2>/dev/null | awk '{print $5}' | grep -Eq "[:.]${port}$"; then
    warn "A porta $port/$protocol já está em uso no host."
    return 1
  fi
  return 0
}

doctor() {
  [[ -f "$ENV_FILE" ]] || init
  require_docker

  local failed=0 mode storage
  mode="$(deploy_mode)"
  storage="$(get_env TUNNARA_STORAGE_DRIVER)"
  [[ "$storage" == sqlite || "$storage" == memory ]] || { warn "TUNNARA_STORAGE_DRIVER deve ser sqlite ou memory no runtime embarcado."; failed=1; }
  [[ "$(admin_token)" =~ ^tnr_admin_[A-Za-z0-9_-]{32,}$ && "$(admin_token)" != *change* ]] || { warn 'Token administrativo inválido ou placeholder.'; failed=1; }
  [[ -n "$(get_env TUNNARA_MASTER_KEY_BASE64)" && "$(get_env TUNNARA_MASTER_KEY_BASE64)" != change-me ]] || { warn 'Chave mestra ausente.'; failed=1; }

  info "Modo de deploy: $mode"
  info "Storage embarcado: $storage"
  info "Versão Docker: $(docker --version)"
  info "Versão Compose: $(docker compose version --short)"

  compose_base config --quiet || { warn 'A composição básica é inválida.'; failed=1; }

  for item in "$(control_port):tcp" "$(console_port):tcp" "$(edge_port):tcp" "$(get_env RELAY_PORT):tcp"; do
    local port="${item%%:*}" proto="${item#*:}"
    [[ -n "$port" ]] && check_port_available "$port" "$proto" || true
  done

  [[ $failed -eq 0 ]] || die 'Diagnóstico encontrou erros bloqueantes.'
  info 'Diagnóstico concluído sem erros bloqueantes.'
}

production_preflight() {
  doctor
  require_cloudflare_env
  compose_full config --quiet
  info "Preflight de produção concluído. Libere 80/tcp, 443/tcp, 443/udp, $(get_env TUNNARA_QUIC_PORT)/udp e a faixa pública TCP/UDP."
}

cloudflare_configure() {
  require_cloudflare_env
  local zone zone_name base email token
  zone="$(get_env CLOUDFLARE_ZONE_ID)"
  zone_name="$(get_env CLOUDFLARE_ZONE_NAME)"
  base="$(get_env TUNNARA_BASE_DOMAIN)"
  email="$(get_env TUNNARA_ACME_EMAIL)"
  token="$(get_env CLOUDFLARE_API_TOKEN)"
  api PUT /api/v1/integrations/cloudflare "{\"apiToken\":\"$token\",\"zoneId\":\"$zone\",\"zoneName\":\"${zone_name:-$base}\",\"managedDomain\":\"$base\",\"acmeEmail\":\"$email\",\"proxied\":false}" | json_pretty
}

show_urls() {
  local base scheme
  base="$(get_env TUNNARA_BASE_DOMAIN)"
  scheme="$(get_env TUNNARA_PUBLIC_SCHEME)"
  cat <<EOF
Console local:  http://127.0.0.1:$(console_port)
Control local:  http://127.0.0.1:$(control_port)
Edge local:     http://127.0.0.1:$(edge_port)
Console público: ${scheme:-http}://console.${base:-tunnara.local}
Control público: ${scheme:-http}://control.${base:-tunnara.local}
Domínio de túneis: ${base:-tunnara.local}
EOF
}

health() {
  local failed=0
  curl -fsS "http://127.0.0.1:$(control_port)/healthz" | json_pretty || failed=1
  curl -fsS "http://127.0.0.1:$(console_port)/healthz" >/dev/null || failed=1
  [[ $failed -eq 0 ]] || die 'Um ou mais serviços não estão saudáveis.'
  info 'Control API e Console estão saudáveis.'
}

quickstart() {
  init
  doctor
  start_stack base
  wait_control
  health
  show_urls
  info 'Use ./tunnara.sh provision "Nome do agente" para gerar um token de instalação.'
}

update_stack() {
  local stack="${1:-base}"
  if [[ "$(get_env TUNNARA_STORAGE_DRIVER)" == sqlite ]]; then
    "$0" backup "$SCRIPT_DIR/backups/pre-update-$(date +%Y%m%d-%H%M%S).sqlite"
  fi
  if [[ "$(deploy_mode)" == image ]]; then
    compose_run "$stack" pull
    compose_run "$stack" up -d --remove-orphans
  else
    compose_run "$stack" up -d --build --remove-orphans
  fi
  wait_control
  health
}


bootstrap_distributed() {
  [[ -f "$ENV_FILE" ]] || init
  local token organization
  token="$(admin_token)"
  organization="$(get_env TUNNARA_BOOTSTRAP_ORGANIZATION)"
  compose_distributed exec -T control-a php artisan tunnara:bootstrap "${organization:-Tunnara Community}" --token-name=Console --token="$token"
}

wait_distributed() {
  local retries=90
  until compose_distributed exec -T control-a wget -q -O - http://127.0.0.1:8080/api/v1/health >/dev/null 2>&1; do
    retries=$((retries-1)); [[ $retries -gt 0 ]] || die 'Control API distribuída não ficou saudável.'; sleep 2
  done
}

backup_distributed() {
  local destination="${1:-$SCRIPT_DIR/backups/tunnara-postgres-$(date +%Y%m%d-%H%M%S).dump}"
  mkdir -p "$(dirname "$destination")"
  compose_distributed exec -T postgres sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$destination"
  [[ -s "$destination" ]] || die 'O backup PostgreSQL foi gerado vazio.'
  chmod 600 "$destination" 2>/dev/null || true
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$destination" > "${destination}.sha256"; else shasum -a 256 "$destination" > "${destination}.sha256"; fi
  info "Backup PostgreSQL distribuído criado: $destination"
}

restore_distributed() {
  local source_file="${1:-}" confirmation="${2:-}"
  [[ -f "$source_file" ]] || die 'Uso: ./tunnara.sh restore-distributed ARQUIVO.dump --force'
  [[ "$confirmation" == --force ]] || die 'Restore distribuído é destrutivo. Repita com --force.'
  compose_distributed stop caddy console edge-a edge-b relay-a relay-b control-a control-b || true
  compose_distributed exec -T postgres sh -ec 'dropdb --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"; createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
  compose_distributed exec -T postgres sh -ec 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' < "$source_file"
  compose_distributed exec -T redis sh -ec 'redis-cli -a "$REDIS_PASSWORD" FLUSHALL >/dev/null'
  compose_distributed up -d
  wait_distributed
  info "Banco distribuído restaurado a partir de: $source_file"
}

set_release_images() {
  local version="$1" key current base
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || die "Versão inválida: $version"
  for key in TUNNARA_SERVER_IMAGE TUNNARA_AGENT_IMAGE TUNNARA_CONSOLE_IMAGE TUNNARA_CONTROL_IMAGE TUNNARA_CADDY_IMAGE TUNNARA_QUIC_IMAGE; do
    current="$(get_env "$key")"
    [[ -n "$current" ]] || continue
    base="${current%:*}"
    set_env "$key" "${base}:${version}"
  done
  set_env TUNNARA_VERSION "$version"
}

update_distributed() {
  local stack="${1:-distributed}" backup
  backup="$SCRIPT_DIR/backups/pre-update-distributed-$(date +%Y%m%d-%H%M%S).dump"
  backup_distributed "$backup"
  compose_run "$stack" pull
  compose_run "$stack" up -d --remove-orphans
  wait_distributed
  info "Atualização distribuída concluída. Backup preventivo: $backup"
}

rollback_distributed() {
  local version="${1:-}" stack="${2:-distributed}"
  [[ -n "$version" ]] || die 'Uso: ./tunnara.sh rollback-distributed VERSAO'
  backup_distributed "$SCRIPT_DIR/backups/pre-rollback-distributed-$(date +%Y%m%d-%H%M%S).dump"
  set_release_images "$version"
  compose_run "$stack" pull
  compose_run "$stack" up -d --remove-orphans
  wait_distributed
  info "Rollback distribuído concluído para $version."
}

case "${1:-help}" in
  init) init ;;
  quickstart) quickstart ;;
  quickstart-build)
    init
    set_env TUNNARA_DEPLOY_MODE build
    quickstart
    ;;
  doctor) doctor ;;
  config) init; compose_base config ;;
  config-production) init; compose_full config ;;
  version) get_env TUNNARA_VERSION ;;
  urls) show_urls ;;
  health) health ;;
  pull) compose_base pull ;;
  update) update_stack base ;;
  update-production) update_stack full ;;
  up) start_stack base ;;
  up-build) init; set_env TUNNARA_DEPLOY_MODE build; start_stack base ;;
  down) compose_base down ;;
  restart) compose_base restart ;;
  status) compose_base ps ;;
  logs) shift; compose_base logs -f --tail=200 "$@" ;;
  destroy) compose_base down --volumes --remove-orphans ;;

  preflight) production_preflight ;;
  up-production)
    production_preflight
    start_stack full
    wait_control
    cloudflare_configure
    api POST /api/v1/integrations/cloudflare/test '{}' | json_pretty
    api POST /api/v1/integrations/cloudflare/bootstrap-dns '{}' | json_pretty
    health
    info "Produção iniciada com Cloudflare, Let's Encrypt, HTTP/3 e QUIC."
    show_urls
    ;;
  down-production) compose_full down ;;
  status-production) compose_full ps ;;
  logs-production) shift; compose_full logs -f --tail=200 "$@" ;;
  destroy-production) compose_full down --volumes --remove-orphans ;;

  up-cloudflare)
    require_cloudflare_env
    start_stack cloudflare
    info 'Depois do health check, execute cloudflare-configure e cloudflare-bootstrap.'
    ;;
  up-cloudflare-tunnel)
    require_cloudflare_env
    [[ -n "$(get_env CLOUDFLARED_TUNNEL_TOKEN)" ]] || die 'CLOUDFLARED_TUNNEL_TOKEN ausente.'
    compose_cloudflare --profile cloudflare-tunnel up -d
    ;;
  down-cloudflare) compose_cloudflare down ;;
  status-cloudflare) compose_cloudflare ps ;;
  logs-cloudflare) shift; compose_cloudflare logs -f --tail=200 "$@" ;;

  up-observability)
    init
    start_stack observability
    wait_control
    info "Observabilidade ativa: Prometheus http://127.0.0.1:$(get_env PROMETHEUS_PORT) e Grafana http://127.0.0.1:$(get_env GRAFANA_PORT)"
    ;;
  down-observability) compose_observability down ;;
  status-observability) compose_observability ps ;;
  logs-observability) shift; compose_observability logs -f --tail=200 "$@" ;;

  up-distributed)
    require_cloudflare_env
    start_stack distributed
    wait_distributed
    bootstrap_distributed
    info 'Plano distribuído iniciado com fallback TCP explícito. Para QUIC público, use up-distributed-quic.'
    ;;
  up-distributed-quic)
    require_cloudflare_env
    start_stack distributed-quic
    wait_distributed
    bootstrap_distributed
    info 'Plano distribuído iniciado com PostgreSQL, Redis, dois Controls, dois Edges, dois Relays e QUIC/TLS 1.3.'
    ;;
  bootstrap-distributed) bootstrap_distributed ;;
  backup-distributed) backup_distributed "${2:-}" ;;
  restore-distributed) restore_distributed "${2:-}" "${3:-}" ;;
  update-distributed) update_distributed distributed ;;
  update-distributed-quic) update_distributed distributed-quic ;;
  rollback-distributed) rollback_distributed "${2:-}" distributed ;;
  rollback-distributed-quic) rollback_distributed "${2:-}" distributed-quic ;;
  down-distributed) compose_distributed down ;;
  down-distributed-quic) compose_distributed_quic down ;;
  status-distributed) compose_distributed ps ;;
  status-distributed-quic) compose_distributed_quic ps ;;
  logs-distributed) shift; compose_distributed logs -f --tail=200 "$@" ;;
  logs-distributed-quic) shift; compose_distributed_quic logs -f --tail=200 "$@" ;;
  destroy-distributed) compose_distributed down --volumes --remove-orphans ;;
  destroy-distributed-quic) compose_distributed_quic down --volumes --remove-orphans ;;

  up-ha)
    require_cloudflare_env
    [[ -n "$(get_env TUNNARA_PUBLIC_HOST)" ]] || die 'TUNNARA_PUBLIC_HOST ausente.'
    start_stack ha
    ;;
  down-ha) compose_ha down ;;
  restart-ha) compose_ha restart ;;
  status-ha) compose_ha ps ;;
  logs-ha) shift; compose_ha logs -f --tail=200 "$@" ;;
  destroy-ha) compose_ha down --volumes --remove-orphans ;;

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
    [[ "$(get_env TUNNARA_STORAGE_DRIVER)" == sqlite ]] || die 'Backup está disponível somente com TUNNARA_STORAGE_DRIVER=sqlite.'
    container_file='/var/lib/tunnara/tunnara-backup-export.sqlite'
    mkdir -p "$(dirname "$destination")"
    compose_base exec -T tunnara-server node /opt/tunnara/runtime/node/bin/tunnara-server.mjs backup --data-dir /var/lib/tunnara --output "$container_file" >/dev/null
    compose_base cp "tunnara-server:$container_file" "$destination"
    compose_base exec -T tunnara-server rm -f "$container_file"
    chmod 600 "$destination" 2>/dev/null || true
    info "Backup SQLite consistente criado: $destination"
    ;;
  restore)
    source_file="${2:-}"
    [[ -f "$source_file" ]] || die 'Uso: ./tunnara.sh restore ARQUIVO.sqlite'
    [[ "$(get_env TUNNARA_STORAGE_DRIVER)" == sqlite ]] || die 'Restore está disponível somente com TUNNARA_STORAGE_DRIVER=sqlite.'
    source_file="$(cd "$(dirname "$source_file")" && pwd)/$(basename "$source_file")"
    compose_base stop tunnara-server
    compose_base run --rm --no-deps -v "$source_file:/restore.sqlite:ro" tunnara-server restore --data-dir /var/lib/tunnara --input /restore.sqlite --force
    compose_base up -d tunnara-server
    info "Backup restaurado: $source_file"
    ;;

  help|-h|--help|*)
    cat <<'USAGE'
Tunnara Docker

Primeiro uso:
  ./tunnara.sh quickstart          usa imagens publicadas no GHCR
  ./tunnara.sh quickstart-build    constrói as imagens pelo código-fonte

Operação básica:
  init | doctor | config | version | urls | health
  up | up-build | down | restart | status | logs
  pull | update | destroy

Produção Cloudflare/ACME/QUIC:
  preflight | config-production | up-production
  down-production | status-production | logs-production
  update-production | destroy-production

Observabilidade:
  up-observability | down-observability | status-observability | logs-observability

Plano distribuído PostgreSQL/Redis:
  up-distributed | up-distributed-quic | bootstrap-distributed
  backup-distributed [arquivo] | restore-distributed arquivo --force
  update-distributed | update-distributed-quic
  rollback-distributed VERSAO | rollback-distributed-quic VERSAO
  down-distributed | down-distributed-quic
  status-distributed | status-distributed-quic
  logs-distributed | logs-distributed-quic
  destroy-distributed | destroy-distributed-quic

Alta disponibilidade embedded:
  up-ha | down-ha | restart-ha | status-ha | logs-ha | destroy-ha

Administração:
  token
  provision [nome]
  backup [arquivo]
  restore arquivo
  cloudflare-configure | cloudflare-test | cloudflare-bootstrap | cloudflare-status

Arquivo de configuração:
  deploy/docker/.env
  TUNNARA_DEPLOY_MODE=image  -> baixa imagens da release/GHCR
  TUNNARA_DEPLOY_MODE=build  -> compila localmente pelo código-fonte
USAGE
    ;;
esac
