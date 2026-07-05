# Transporte QUIC Agent ↔ Relay

A Tunnara possui duas formas operacionais de QUIC:

1. **Tunnara QUIC Bridge**: transporta o protocolo persistente Agent/Relay em streams QUIC/TLS 1.3.
2. **Borda HTTP/3/Cloudflare Tunnel**: Caddy atende HTTP/3 em `443/udp` e o `cloudflared` opcional conecta usando QUIC.

## Bridge nativo

No servidor Relay:

```bash
tunnara-quic-bridge server \
  --listen 0.0.0.0:7443 \
  --upstream 127.0.0.1:7300 \
  --cert /etc/tunnara/quic/fullchain.pem \
  --key /etc/tunnara/quic/privkey.pem
```

No dispositivo Agent:

```bash
tunnara-quic-bridge client \
  --listen 127.0.0.1:17300 \
  --remote relay.tunnel.example.com:7443 \
  --server-name relay.tunnel.example.com \
  --ca /etc/tunnara/quic/ca.pem

tunnara login \
  --relay-url tcp://127.0.0.1:17300 \
  --control-url https://control.tunnel.example.com \
  --token tnr_prov_xxx
```

Cada conexão TCP do Agent é mapeada para um stream QUIC bidirecional. O bridge mantém um canal QUIC e multiplexa conexões, com TLS 1.3, keepalive e reconexão.

## Docker

```bash
docker compose \
  --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.quic.yml \
  up -d --build
```

Variáveis:

```dotenv
TUNNARA_QUIC_CERT_DIR=/etc/letsencrypt/live/relay.tunnel.example.com
TUNNARA_QUIC_PUBLIC_HOST=relay.tunnel.example.com
TUNNARA_QUIC_PORT=7443
```

Libere `7443/udp` no firewall. Caddy HTTP/3 utiliza `443/udp` separadamente.
