# Cloudflare + Let's Encrypt

Esta composição usa:

- API DNS Cloudflare para registros gerenciados;
- Caddy com módulo `caddy-dns/cloudflare`;
- ACME DNS-01 do Let's Encrypt;
- certificado wildcard `*.SEU_DOMINIO`;
- HTTP/1.1, HTTP/2 e HTTP/3 na borda;
- `cloudflared` opcional usando protocolo QUIC.

O token Cloudflare deve ter, no mínimo, acesso de leitura à zona e edição de DNS apenas na zona utilizada pelo Tunnara.

```bash
cp .env.example .env
./tunnara.sh init
# edite domínio, e-mail, IP/hostname público e token Cloudflare
./tunnara.sh up-cloudflare
./tunnara.sh cloudflare-configure
./tunnara.sh cloudflare-bootstrap
```

Use inicialmente a CA staging para evitar limites durante testes:

```env
TUNNARA_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory
```

Depois troque para produção e remova o volume `caddy_data` apenas se desejar emitir um novo certificado.
