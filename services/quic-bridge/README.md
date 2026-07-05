# Tunnara QUIC Bridge

Bridge operacional para transportar o protocolo persistente Agent ↔ Relay sobre QUIC/TLS 1.3.
Cada conexão TCP local é mapeada para um stream bidirecional QUIC, permitindo multiplexação sem alterar o protocolo de aplicação do runtime.

## Relay/servidor

```bash
tunnara-quic-bridge server \
  --listen 0.0.0.0:7443 \
  --upstream 127.0.0.1:7300 \
  --cert /etc/tunnara/quic/fullchain.pem \
  --key /etc/tunnara/quic/privkey.pem
```

## Agent/cliente

```bash
tunnara-quic-bridge client \
  --listen 127.0.0.1:17300 \
  --remote relay.example.com:7443 \
  --server-name relay.example.com \
  --ca /etc/tunnara/quic/ca.pem

# O Agent usa o listener local do bridge:
tunnara login --relay-url tcp://127.0.0.1:17300 ...
```

O QUIC utiliza UDP. Libere `7443/udp` ou a porta escolhida. O certificado deve possuir o nome informado em `--server-name`.
