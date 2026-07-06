# Roadmap Tunnara

## Entregue até 2.0.0-rc.6

- HTTP/HTTPS/WebSocket/TCP/UDP.
- Cloudflare DNS, ACME DNS-01 e QUIC Bridge.
- WireGuard e redes privadas.
- Multi-edge/multi-relay e failover.
- Control Plane distribuído PostgreSQL/MySQL + Redis.
- Agent sessions, presence, nodes e rotas internas.
- Policy Engine, JWT/OIDC, Basic Auth, API key, rate limit e transforms.
- Request Inspector, redação e replay.
- Múltiplos targets, health check, prioridade, peso e failover.
- Prometheus/Grafana.
- Docker single-node/distribuído e Helm Chart.
- SDK C/Delphi, Console e projetos mobile.
- Fuzzing, benchmark e suite E2E.

## 2.0.0 GA — gates, não novos recursos cosméticos

- domínio real com Cloudflare/ACME/QUIC;
- Composer/PHPUnit e migrations em PostgreSQL/MySQL reais;
- compilação e E2E do workspace Rust em todos os targets;
- soak test multi-host de pelo menos 7 dias;
- chaos tests de Control, PostgreSQL, Redis, Edge e Relay;
- testes físicos Android/iOS e suspensão/retomada;
- assinatura/notarização dos binários;
- pentest e auditoria externa sem achados críticos/altos abertos;
- SLOs, alertas, runbooks e rollback aprovados.

## Pós-GA

- NAT traversal direto com STUN/hole punching e relay fallback;
- Kubernetes Operator e CRDs;
- SAML, SCIM, LDAP e device posture;
- armazenamento analítico de inspeções em larga escala;
- geo-routing/Anycast;
- SDKs Go, Python, .NET, Java, Node e PHP;
- Terraform Provider.
