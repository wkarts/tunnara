# Implantação Docker

## Requisitos

## Arquivos Compose de exemplo

A distribuição atual inclui exemplos diretamente executáveis:

- `docker-compose.example.yml`: instalação local/VPS sem TLS;
- `deploy/docker/examples/docker-compose.local.yml`: equivalente local;
- `deploy/docker/examples/docker-compose.vps.yml`: VPS com Cloudflare, ACME DNS-01 e QUIC.

Instruções completas: `docs/operations/VPS_DOCKER_QUICKSTART.md`.


- Linux x86_64 ou ARM64.
- Docker Engine.
- Docker Compose v2.
- Portas locais livres para os serviços escolhidos.

## Stack Community single-node

```bash
./docker.sh quickstart
```

Serviços:

- `tunnara-server`: Control, Edge, Relay, TCP/UDP ingress e SQLite/memory.
- `console`: interface web.

O token e as chaves são gerados em `deploy/docker/.env` com permissão `0600`.

## Imagens prontas ou build local

No `.env`:

```dotenv
TUNNARA_DEPLOY_MODE=image
```

Usa:

```text
ghcr.io/wkarts/tunnara-server
ghcr.io/wkarts/tunnara-console
ghcr.io/wkarts/tunnara-agent
ghcr.io/wkarts/tunnara-quic-bridge
ghcr.io/wkarts/tunnara-caddy-cloudflare
ghcr.io/wkarts/tunnara-control-api
```

Para compilar localmente:

```bash
./docker.sh quickstart-build
```

## Diagnóstico

```bash
./docker.sh doctor
./docker.sh config
./docker.sh status
./docker.sh health
./docker.sh logs
```

## Atualização segura

```bash
./docker.sh update
```

Com SQLite, o comando cria backup antes de atualizar as imagens.

## Backup

```bash
./docker.sh backup /backup/tunnara.sqlite
./docker.sh restore /backup/tunnara.sqlite
```

Também preserve `deploy/docker/.env` e os volumes do Caddy.

## Produção com Cloudflare

Configure o `.env` e execute:

```bash
./docker.sh preflight
./docker.sh up-production
```

Portas:

- `80/tcp`;
- `443/tcp`;
- `443/udp`;
- `7443/udp`;
- faixa TCP/UDP pública configurada.

## Alta disponibilidade local

```bash
./docker.sh up-ha
```

Esse perfil usa um Control SQLite único e duplica Edge e Relay. HA do plano de gestão entre hosts deve usar a Control API Laravel com PostgreSQL/MySQL e Redis.

## Instalação sem clonar o repositório

Depois que a release desejada estiver publicada, o asset `Tunnara-Docker-vX.Y.Z.zip` pode ser instalado diretamente:

```bash
curl -fsSL https://raw.githubusercontent.com/wkarts/tunnara/main/deploy/docker/install-from-github.sh | sudo bash
```

Versão específica e diretório customizado:

```bash
TUNNARA_VERSION=2.0.0-rc.4 \
TUNNARA_INSTALL_DIR=/opt/tunnara \
TUNNARA_START_MODE=image \
  bash install-from-github.sh
```

Para repositório privado, defina `GITHUB_TOKEN` somente no ambiente da execução.

## Control API com PostgreSQL/MySQL e Redis

O runtime Community executa Control/Edge/Relay com SQLite ou memória. O plano de gestão Laravel distribuído possui composição independente:

```bash
cd deploy/docker/storage
./storage.sh init
./storage.sh up postgres redis
```

Ou:

```bash
./storage.sh up mysql redis
```

Esse perfil não deve ser confundido com a substituição automática do SQLite do runtime embarcado. A integração total entre o plano distribuído Laravel e o data plane permanece modular e explícita.
