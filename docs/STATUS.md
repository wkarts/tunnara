# Estado da implementação — Tunnara 2.0.0-rc.4

## Integrado e validado localmente

- HTTP/HTTPS de aplicação e WebSocket.
- TCP e UDP públicos.
- Agent com identidade Ed25519, nonce e proteção contra replay.
- Control, Edge e Relay separados.
- Multi-edge/multi-relay e failover.
- QUIC Bridge/TLS 1.3 integrado ao Agent.
- Cloudflare DNS, subdomínios e lifecycle.
- Caddy/Let’s Encrypt DNS-01, wildcard, HTTP/2 e HTTP/3.
- Policy Engine com autenticação, autorização, rate limit e transformações.
- Request Inspector com redação, retenção e replay.
- Targets com peso, prioridade, health check e failover.
- WireGuard e redes privadas.
- Métricas Prometheus e dashboard Grafana.
- Console Vue/TypeScript.
- SDK C ABI.
- Runtime standalone Linux.
- Docker single-node, produção e plano distribuído.
- Testes funcionais, fuzzing e benchmark local.

## Control Plane distribuído

O Control API Laravel oferece:

- SQLite, PostgreSQL e MySQL.
- Redis para cache, sessão e filas.
- organizações e isolamento por tenant;
- service tokens com abilities;
- provisionamento descartável;
- Agent sessions;
- políticas;
- túneis e múltiplos targets;
- nodes, heartbeat e presença;
- rotas internas para Edge/Relay;
- health status de targets;
- inspeções persistidas.

O perfil `docker-compose.distributed.yml` executa duas instâncias do Control API sobre PostgreSQL/Redis.

## Entregue, mas dependente de CI/plataforma externa

- Builds Rust completos e QUIC multiplataforma.
- Desktop Tauri Windows/Linux/macOS.
- APK/AAB.
- aplicativo de simulador, archive e IPA iOS.
- assinatura, notarização e publicação em lojas.
- imagens Docker amd64/arm64 no GHCR.

## Gates antes de GA

- ACME/Cloudflare em domínio real.
- soak test multi-host de longa duração.
- testes de carga em infraestrutura dedicada.
- chaos test de PostgreSQL, Redis, Edge e Relay.
- dispositivos Android/iOS físicos.
- pentest e auditoria externa.
- revisão de privacidade e retenção do Inspector.

Por isso, a versão é classificada como Release Candidate, não como GA certificada.
