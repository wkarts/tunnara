# Subir a Tunnara em Docker — local e VPS

Este guia usa arquivos Compose explícitos e não depende de conhecer os scripts internos do projeto.

## Opção A — ambiente local ou VPS sem TLS

Na raiz do repositório:

```bash
./docker.sh init

docker compose \
  -f docker-compose.example.yml \
  --env-file deploy/docker/.env \
  pull

docker compose \
  -f docker-compose.example.yml \
  --env-file deploy/docker/.env \
  up -d
```

Verifique:

```bash
docker compose -f docker-compose.example.yml --env-file deploy/docker/.env ps
curl -fsS http://127.0.0.1:7100/healthz
```

Acessos padrão:

- Console: `http://IP_DA_VPS:7400`
- Edge HTTP: `http://IP_DA_VPS:8080`
- Control API: `http://127.0.0.1:7100`
- Relay TCP: `tcp://IP_DA_VPS:7300`

Em uma VPS, mantenha a Control API vinculada a `127.0.0.1` e exponha apenas as portas necessárias.

## Opção B — VPS com Cloudflare, Let’s Encrypt e QUIC

```bash
cp deploy/docker/examples/vps.env.example deploy/docker/examples/.env.vps
```

Edite obrigatoriamente:

```dotenv
TUNNARA_BASE_DOMAIN=tunnel.seudominio.com.br
TUNNARA_PUBLIC_CONTROL_URL=https://control.tunnel.seudominio.com.br
TUNNARA_PUBLIC_RELAY_URL=quic://relay.tunnel.seudominio.com.br:7443
TUNNARA_CORS_ORIGIN=https://console.tunnel.seudominio.com.br
CLOUDFLARE_ZONE_NAME=seudominio.com.br
CLOUDFLARE_API_TOKEN=TOKEN_RESTRITO
TUNNARA_ACME_EMAIL=admin@seudominio.com.br
TUNNARA_CLOUDFLARE_EDGE_ADDRESS=IP_PUBLICO_DA_VPS
TUNNARA_QUIC_PUBLIC_HOST=relay.tunnel.seudominio.com.br
```

Gere segredos antes do primeiro start. O caminho recomendado é:

```bash
./docker.sh init
```

Copie de `deploy/docker/.env` para `deploy/docker/examples/.env.vps` os valores:

```dotenv
TUNNARA_BOOTSTRAP_ADMIN_TOKEN=
TUNNARA_MASTER_KEY_BASE64=
TUNNARA_CLUSTER_TOKEN=
```

Valide e suba:

```bash
docker compose \
  -f deploy/docker/examples/docker-compose.vps.yml \
  --env-file deploy/docker/examples/.env.vps \
  config

docker compose \
  -f deploy/docker/examples/docker-compose.vps.yml \
  --env-file deploy/docker/examples/.env.vps \
  pull

docker compose \
  -f deploy/docker/examples/docker-compose.vps.yml \
  --env-file deploy/docker/examples/.env.vps \
  up -d
```

## Firewall da VPS

Libere conforme o perfil usado:

- `80/tcp` e `443/tcp`: HTTP/HTTPS;
- `443/udp`: HTTP/3;
- `7443/udp`: Agent/Relay sobre QUIC;
- `7300/tcp`: fallback Relay TCP, quando habilitado;
- faixa `20000-20100/tcp` e `20000-20100/udp`: túneis públicos genéricos.

Não exponha a porta `7100` publicamente sem proxy TLS e controle de acesso.

## Operação

```bash
docker compose -f docker-compose.example.yml --env-file deploy/docker/.env logs -f
docker compose -f docker-compose.example.yml --env-file deploy/docker/.env restart
docker compose -f docker-compose.example.yml --env-file deploy/docker/.env down
```

Ou use os comandos operacionais do projeto:

```bash
./docker.sh status
./docker.sh health
./docker.sh logs
./docker.sh backup
./docker.sh update
```

## PostgreSQL, MySQL e Redis

O Compose principal single-node usa o runtime embarcado com SQLite ou memória. O plano de gestão Laravel distribuído possui perfis independentes:

```bash
cd deploy/docker/storage
./storage.sh init
./storage.sh up postgres redis
# ou
./storage.sh up mysql redis
```

Isso ainda não transforma automaticamente o banco do data plane Node em PostgreSQL/MySQL; são planos separados e essa integração completa precisa ser tratada explicitamente na arquitetura distribuída.
