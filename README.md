# Tunnara Platform

A Tunnara é uma plataforma self-hosted de conectividade para publicar serviços atrás de NAT/CGNAT, criar túneis HTTP/HTTPS/WebSocket/TCP/UDP, operar redes privadas WireGuard e integrar aplicações por CLI e SDK.

## O que esta versão entrega

- Runtime funcional com Control, Edge, Relay e Agent.
- Túneis HTTP/HTTPS, WebSocket, TCP e UDP.
- Transporte Agent–Relay por TCP/TLS ou QUIC/TLS 1.3.
- Cloudflare DNS, subdomínios automáticos e wildcard.
- Let’s Encrypt por ACME DNS-01, HTTP/2 e HTTP/3 com Caddy.
- Multi-edge, multi-relay, heartbeat e failover.
- Redes privadas WireGuard.
- Console Vue 3/Tauri.
- SDK C ABI e integração Delphi.
- Projetos Android e iOS.
- Docker, CloudPanel, serviços nativos e GitHub Releases.

## Exemplos Docker Compose prontos

Para quem deseja montar a stack diretamente, sem depender dos scripts auxiliares, o repositório inclui:

```text
docker-compose.example.yml                         # local/VPS sem TLS
deploy/docker/examples/docker-compose.local.yml   # exemplo local
deploy/docker/examples/docker-compose.vps.yml     # VPS + Cloudflare + Let's Encrypt + QUIC
```

Guia passo a passo: [`docs/operations/VPS_DOCKER_QUICKSTART.md`](docs/operations/VPS_DOCKER_QUICKSTART.md).

## Instalação Docker mais simples

### Usando as imagens da release

```bash
git clone https://github.com/wkarts/tunnara.git
cd tunnara
./docker.sh quickstart
```

O comando:

1. cria `deploy/docker/.env` a partir do modelo;
2. gera token administrativo, chave mestra e cluster token;
3. valida Docker e o Compose;
4. baixa as imagens publicadas no GHCR;
5. inicia Server e Console;
6. aguarda os health checks.

Endereços locais padrão:

```text
Console: http://localhost:7400
Control: http://127.0.0.1:7100
Edge:    http://localhost:8080
Relay:   tcp://localhost:7300
```

Obtenha o token administrativo:

```bash
./docker.sh token
```

Gere um token para instalar um Agent:

```bash
./docker.sh provision servidor-erp
```

### Construindo localmente

```bash
./docker.sh quickstart-build
```

Esse modo usa o código-fonte atual e não depende das imagens do GHCR.

## Produção com Cloudflare e SSL automático

```bash
cd deploy/docker
./tunnara.sh init
```

Edite `deploy/docker/.env`:

```dotenv
TUNNARA_BASE_DOMAIN=tunnel.seudominio.com.br
TUNNARA_PUBLIC_HOST=edge.seudominio.com.br
TUNNARA_PUBLIC_CONTROL_URL=https://control.tunnel.seudominio.com.br
TUNNARA_PUBLIC_RELAY_URL=quic://relay.tunnel.seudominio.com.br:7443
TUNNARA_PUBLIC_SCHEME=https
TUNNARA_CORS_ORIGIN=https://console.tunnel.seudominio.com.br

CLOUDFLARE_ZONE_NAME=seudominio.com.br
CLOUDFLARE_API_TOKEN=TOKEN_RESTRITO_DA_ZONA
TUNNARA_ACME_EMAIL=administrador@seudominio.com.br
TUNNARA_CLOUDFLARE_EDGE_ADDRESS=IP_PUBLICO_DA_VPS
TUNNARA_QUIC_PUBLIC_HOST=relay.tunnel.seudominio.com.br
```

Depois:

```bash
./tunnara.sh preflight
./tunnara.sh up-production
./tunnara.sh status-production
```

A stack cria ou atualiza os registros DNS, solicita o wildcard Let’s Encrypt, publica HTTPS/HTTP3 e disponibiliza o Relay QUIC.

## Operação Docker

```bash
./docker.sh doctor
./docker.sh health
./docker.sh urls
./docker.sh status
./docker.sh logs
./docker.sh update
./docker.sh backup
```

Documentação detalhada: [`docs/operations/DOCKER_DEPLOYMENT.md`](docs/operations/DOCKER_DEPLOYMENT.md).

Análise honesta das lacunas para paridade com ngrok/Pangolin: [`docs/architecture/COMPETITIVE_GAP.md`](docs/architecture/COMPETITIVE_GAP.md).

## Storage e bancos

A Tunnara possui dois perfis:

### Runtime embarcado funcional

- `sqlite`: persistência local e backup.
- `memory`: execução efêmera.

Esse runtime executa o caminho de dados completo e é o perfil padrão da Community Edition.

### Control API Laravel

O plano de gestão em `apps/control-api` suporta:

- SQLite;
- PostgreSQL;
- MySQL/MariaDB;
- cache, sessão e filas por arquivo, banco, memória ou Redis.

```bash
cd deploy/docker/storage
./storage.sh init
./storage.sh up postgres redis
```

A separação entre os dois perfis está documentada em [`docs/operations/STORAGE_PROVIDERS.md`](docs/operations/STORAGE_PROVIDERS.md). PostgreSQL/MySQL/Redis não substituem silenciosamente o banco do runtime embarcado; eles pertencem ao plano de gestão distribuído.

## CLI do Agent

```bash
tunnara login --token TOKEN --control-url https://control.tunnel.seudominio.com.br
tunnara serve

tunnara http 8080 --domain erp.tunnel.seudominio.com.br --auto-dns
tunnara tcp 22 --remote-port 22022
tunnara udp 51820 --remote-port 25182

tunnara network list
tunnara network join UUID_DA_REDE
```

## Releases e GitHub Actions

Pull Requests executam apenas validações, sem gerar artifacts temporários. Uma nova release é iniciada somente quando o arquivo `VERSION` muda em `main`.

O workflow cria uma release draft, compila o núcleo, chama os workflows reutilizáveis de Runtime, SDK, Desktop, Mobile e Containers e publica a release somente quando todos os builds obrigatórios terminam.

```bash
npm run version:set -- X.Y.Z
npm run version:check
```

Consulte [`docs/operations/RELEASE_PROCESS.md`](docs/operations/RELEASE_PROCESS.md).

## Desenvolvimento

```bash
npm ci
npm --prefix apps/console ci
npm run validate
```

Testes funcionais cobrem HTTP/WebSocket, TCP, UDP, Cloudflare, failover, WireGuard e redes privadas.

## Estrutura

```text
apps/        Console e Control API
runtime/     Server/Agent funcional de referência
crates/      Núcleo e transporte Rust
services/    Serviços Rust
sdk/         C, Delphi, Android e iOS
deploy/      Docker, CloudPanel e instalações nativas
docs/        Arquitetura e operação
```

## Licenciamento

Consulte `LICENSE` e `LICENSE-NOTICE.md`.
