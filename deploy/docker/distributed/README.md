# Tunnara Distributed Control Plane

Este perfil usa PostgreSQL como fonte de verdade, Redis para cache/sessões/filas, duas instâncias Laravel do Control API, dois Edges e dois Relays.

## Fallback TCP/TLS

```bash
cd deploy/docker
./tunnara.sh init
# complete TUNNARA_BASE_DOMAIN, CLOUDFLARE_API_TOKEN, TUNNARA_ACME_EMAIL,
# DB_PASSWORD, REDIS_PASSWORD e TUNNARA_PUBLIC_HOST em .env
./tunnara.sh up-distributed
./tunnara.sh bootstrap-distributed
./tunnara.sh status-distributed
```

## QUIC/TLS 1.3

```bash
./tunnara.sh up-distributed-quic
./tunnara.sh status-distributed-quic
./tunnara.sh logs-distributed-quic
```

O overlay `docker-compose.distributed.quic.yml` adiciona:

- exportação controlada dos certificados do Caddy;
- `tunnara-quic-bridge`;
- UDP/7443;
- descoberta do Relay QUIC pelos Controls.

O bootstrap usa `TUNNARA_BOOTSTRAP_ADMIN_TOKEN` do `.env` e pode ser executado novamente sem perder dados; um novo token somente é criado quando necessário.

## Backup, atualização e rollback

```bash
./tunnara.sh backup-distributed
./tunnara.sh update-distributed
./tunnara.sh update-distributed-quic
./tunnara.sh rollback-distributed 2.0.0-rc.1
./tunnara.sh rollback-distributed-quic 2.0.0-rc.1
```

Para restaurar um backup PostgreSQL:

```bash
./tunnara.sh restore-distributed /caminho/backup.dump --force
```

O restore interrompe temporariamente os componentes que escrevem no plano de controle. Execute-o em janela de manutenção e valide o serviço antes de liberar tráfego.

## Implantação multi-host

Distribua Control, Edge e Relay em VPS distintas, mantenha PostgreSQL/Redis gerenciados ou replicados e use as mesmas variáveis `TUNNARA_CLUSTER_TOKEN` e `TUNNARA_INTERNAL_CONTROL_URL`.

Não compartilhe SQLite entre múltiplos Controls. SQLite é exclusivo do modo single-node.
