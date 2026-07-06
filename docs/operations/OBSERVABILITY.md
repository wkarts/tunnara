# Observabilidade

## Docker

```bash
cd deploy/docker
./tunnara.sh up-observability
```

Prometheus coleta `/metrics` da Control API. Grafana é provisionado com o dashboard `Tunnara Overview`.

Variáveis:

```dotenv
PROMETHEUS_BIND=127.0.0.1
PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=15d
GRAFANA_BIND=127.0.0.1
GRAFANA_PORT=3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=gerada_pelo_init
```

## Métricas principais

- requisições HTTP e duração;
- conexões ativas;
- decisões de policy;
- Agents conectados;
- streams e pendências do Relay;
- saúde de targets;
- capturas do Inspector.

O endpoint `/metrics` não deve ser publicado na Internet. O Caddy de produção bloqueia a rota pública.
