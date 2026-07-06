# Implantação de produção — Tunnara 2.0.0-rc.6

## Perfil recomendado

- Ubuntu ou Debian atualizado.
- Docker Engine e Compose v2.
- 2 vCPU, 4 GB RAM e SSD para uma instalação inicial.
- Domínio administrado pela Cloudflare.
- IPv4 ou IPv6 público.

## Instalação

```bash
git clone https://github.com/wkarts/tunnara.git
cd tunnara/deploy/docker
./tunnara.sh init
```

Edite `.env`, depois:

```bash
./tunnara.sh preflight
./tunnara.sh up-production
./tunnara.sh health
```

## ACME

Para homologação:

```dotenv
TUNNARA_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
```

Para produção:

```dotenv
TUNNARA_ACME_CA=https://acme-v02.api.letsencrypt.org/directory
```

O volume `caddy_data` preserva conta ACME e certificados.

## Cloudflare

`CLOUDFLARE_ZONE_NAME` é a zona raiz. `TUNNARA_BASE_DOMAIN` pode ser um subdomínio dedicado.

```dotenv
CLOUDFLARE_ZONE_NAME=seudominio.com.br
TUNNARA_BASE_DOMAIN=tunnel.seudominio.com.br
```

O bootstrap gerencia domínio base, wildcard, `control`, `console` e `relay`.

## Atualização

```bash
./tunnara.sh update-production
```

A release fixa a versão das imagens por `TUNNARA_VERSION`. Altere a versão ou as imagens no `.env` antes de atualizar.

## Instalação pela release

O pacote Docker publicado em cada release permite instalar sem compilar o monorepo:

```bash
curl -fsSL \
  https://raw.githubusercontent.com/wkarts/tunnara/main/deploy/docker/install-from-github.sh \
  -o /tmp/tunnara-install.sh

TUNNARA_VERSION=2.0.0-rc.6 \
TUNNARA_START_MODE=none \
  sudo -E bash /tmp/tunnara-install.sh

cd /opt/tunnara/deploy/docker
./tunnara.sh init
# edite .env
./tunnara.sh preflight
./tunnara.sh up-production
```

Use primeiro a CA de staging do Let’s Encrypt para validar DNS e firewall. Troque para a CA de produção somente depois que o preflight e os health checks estiverem estáveis.
