# Quickstart — Tunnara 1.0.0

## Desenvolvimento local

```bash
export TUNNARA_BOOTSTRAP_ADMIN_TOKEN="tnr_admin_$(openssl rand -hex 24)"
export TUNNARA_BASE_DOMAIN=tunnara.local
node runtime/node/bin/tunnara-server.mjs serve-all
```

Em outro terminal:

```bash
node runtime/node/bin/tunnara.mjs admin provision \
  --admin-token "$TUNNARA_BOOTSTRAP_ADMIN_TOKEN" \
  --control-url http://127.0.0.1:7100 \
  --name notebook
```

Use o token retornado:

```bash
node runtime/node/bin/tunnara.mjs login --token TOKEN --control-url http://127.0.0.1:7100
node runtime/node/bin/tunnara.mjs http 8080 --domain app.tunnara.local
```

## Produção

Consulte `docs/operations/PRODUCTION.md` e execute `deploy/docker/tunnara.sh up-production`.
