# Estado de implementação — Tunnara 1.0.0

## Funcional e validado localmente

- Control API, Edge, Relay e Agent.
- HTTP/HTTPS de aplicação e WebSocket.
- TCP público genérico e UDP público.
- Cloudflare DNS API e lifecycle de subdomínio.
- Wildcard e registros base.
- Configuração Caddy/Let’s Encrypt DNS-01 e HTTP/3.
- Multi-edge/multi-relay, registro de nós e failover do Agent.
- WireGuard manager e API de redes privadas/peers.
- SDK C compartilhado e estático.
- Console Vue/TypeScript.
- Backup, restore e diagnóstico.

## Implementado em Rust e validado pelo CI

- Crate QUIC/TLS 1.3 com streams e datagramas.
- `tunnara-quic-bridge` para multiplexar o protocolo Agent/Relay sobre QUIC.
- Workspace de serviços nativos.

## Projetos mobile entregues

- Android com `VpnService` e backend WireGuard.
- iOS com Network Extension e WireGuardKit.

A assinatura e publicação nas lojas dependem das credenciais do proprietário.

## Alta disponibilidade

O plano de dados suporta múltiplos Edges e Relays em hosts/regiões diferentes. A stack `docker-compose.ha.yml` demonstra redundância local do Control. HA do Control entre hosts requer PostgreSQL/datastore replicado e a implantação Laravel ou serviço de banco gerenciado; SQLite não deve ser compartilhado por NFS.
