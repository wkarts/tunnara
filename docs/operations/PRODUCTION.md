# Implantação de produção — Tunnara 1.0.0

## Perfil recomendado

- Ubuntu/Debian atualizado.
- Docker Engine e Compose v2.
- 2 vCPU, 4 GB RAM e SSD para instalação inicial.
- Domínio na Cloudflare.
- IPv4/IPv6 público ou hostname de borda.

## Firewall

- `80/tcp`: desafio/redirecionamento HTTP.
- `443/tcp`: HTTPS HTTP/1.1 e HTTP/2.
- `443/udp`: HTTP/3.
- `7443/udp`: QUIC Agent/Relay.
- `7300/tcp`: fallback TCP/TLS do Relay, se habilitado.
- faixa configurada `PUBLIC_PORT_MIN..PUBLIC_PORT_MAX` em TCP/UDP.

## Instalação

```bash
cd deploy/docker
cp .env.example .env
./tunnara.sh init
# edite .env
./tunnara.sh preflight
./tunnara.sh up-production
```

## ACME

Em homologação use:

```dotenv
TUNNARA_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
```

Depois altere para produção e reinicie Caddy. O volume `caddy_data` preserva conta, certificados e estado de renovação.

## Cloudflare

Configure `CLOUDFLARE_ZONE_NAME` com a zona raiz da Cloudflare e `TUNNARA_BASE_DOMAIN` com o subdomínio reservado à plataforma.

O bootstrap cria registros para:

- domínio base;
- wildcard;
- `control`;
- `console`;
- `relay`.

Túneis HTTP/HTTPS com `autoDns=true` criam/removem registros vinculados ao lifecycle. Use `proxied=false` para Relay, TCP e UDP. A nuvem laranja deve ser usada somente em protocolos/portas suportados pela Cloudflare.

## QUIC

O Caddy atende HTTP/3 em `443/udp`. O `tunnara-quic-bridge` atende Agent/Relay em `7443/udp`, usando o wildcard Let’s Encrypt exportado do storage do Caddy.

## Backup

```bash
./tunnara.sh backup /backup/tunnara.sqlite
./tunnara.sh restore /backup/tunnara.sqlite
```

Mantenha cópia externa criptografada do `.env`, banco e volume Caddy.

## Multi-host

Instale o Control central e execute `tunnara-server relay`/`edge` em outros hosts com:

```dotenv
TUNNARA_INTERNAL_CONTROL_URL=https://control-interno.example
TUNNARA_CLUSTER_TOKEN=...
TUNNARA_REGION=sa-east-1
```

Use load balancer e health checks. Para Control ativo-ativo entre hosts, utilize o plano Laravel/PostgreSQL ou datastore replicado.
