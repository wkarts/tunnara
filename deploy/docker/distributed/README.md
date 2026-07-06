# Tunnara Distributed Control Plane

Este perfil usa PostgreSQL como fonte de verdade, Redis para cache/sessões/filas, duas instâncias Laravel do Control API, dois Edges e dois Relays.

```bash
cd deploy/docker
./tunnara.sh init
# complete TUNNARA_BASE_DOMAIN, CLOUDFLARE_API_TOKEN, TUNNARA_ACME_EMAIL,
# DB_PASSWORD, REDIS_PASSWORD e TUNNARA_PUBLIC_HOST em .env
./tunnara.sh up-distributed
./tunnara.sh bootstrap-distributed
./tunnara.sh status-distributed
```

O bootstrap usa `TUNNARA_BOOTSTRAP_ADMIN_TOKEN` do `.env` e pode ser executado novamente sem perder dados; um novo token somente é criado quando necessário.

Para uma implantação multi-host, distribua Control, Edge e Relay em VPS distintas, mantenha PostgreSQL/Redis gerenciados ou replicados e use as mesmas variáveis `TUNNARA_CLUSTER_TOKEN` e `TUNNARA_INTERNAL_CONTROL_URL`.
