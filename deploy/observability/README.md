# Observabilidade Tunnara

A composição adiciona Prometheus e Grafana à stack existente sem expor métricas na Internet. Por padrão, as portas são vinculadas apenas a `127.0.0.1`.

```bash
cd deploy/docker
./tunnara.sh init
# Defina GRAFANA_ADMIN_PASSWORD em .env
docker compose --env-file .env -f docker-compose.yml -f docker-compose.observability.yml up -d
```

- Prometheus: `http://127.0.0.1:9090`
- Grafana: `http://127.0.0.1:3000`
- Dashboard provisionado: **Tunnara Platform Overview**

Em produção, use VPN, túnel SSH ou um proxy autenticado para acessar essas interfaces.
