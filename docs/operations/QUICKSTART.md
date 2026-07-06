# Quickstart — Tunnara 2.0.0-rc.4

## Docker

```bash
git clone https://github.com/wkarts/tunnara.git
cd tunnara
./docker.sh quickstart
```

Verifique:

```bash
./docker.sh health
./docker.sh urls
./docker.sh token
```

Crie um token de Agent:

```bash
./docker.sh provision notebook
```

## Código-fonte local

```bash
npm ci
export TUNNARA_BOOTSTRAP_ADMIN_TOKEN="tnr_admin_$(openssl rand -hex 24)"
node runtime/node/bin/tunnara-server.mjs serve-all
```

Em outro terminal:

```bash
node runtime/node/bin/tunnara.mjs admin provision \
  --admin-token "$TUNNARA_BOOTSTRAP_ADMIN_TOKEN" \
  --control-url http://127.0.0.1:7100 \
  --name notebook
```

## Próximos passos

- Docker: `docs/operations/DOCKER_DEPLOYMENT.md`.
- Produção: `docs/operations/PRODUCTION.md`.
- Storage: `docs/operations/STORAGE_PROVIDERS.md`.
