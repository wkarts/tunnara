# Roadmap Tunnara

## Entregue até 2.0.0-rc.2

- Runtime funcional HTTP/HTTPS/WebSocket/TCP/UDP.
- Cloudflare DNS, ACME DNS-01, HTTP/3 e QUIC Bridge.
- WireGuard e redes privadas.
- Multi-edge/multi-relay, targets, health check e failover.
- Control Plane Laravel sobre PostgreSQL/MySQL e Redis; modo embedded SQLite/memory.
- Agent sessions, presence, nodes e rotas internas.
- Policy Engine, JWT/OIDC, Basic Auth, API key, rate limit e transformações.
- Request Inspector, redação e replay.
- Prometheus/Grafana, Docker single-node/distribuído/QUIC e Helm.
- SDK C/Delphi, Console e bases mobile.
- Pipeline imutável, idempotente, sem artifacts temporários em PRs.
- Backup, restore, update e rollback do plano distribuído.

## 2.0.0 GA — gates obrigatórios

- domínio real com Cloudflare/ACME/QUIC;
- migrations e failover em PostgreSQL/MySQL reais;
- decisão arquitetural final e testes de paridade do plano de dados nativo;
- soak multi-host ≥ 7 dias;
- carga e caos conforme `docs/security/MATURITY_GATES.md`;
- Android/iOS físicos e desktop assinado/notarizado;
- pentest/auditoria externa;
- SLOs, alertas, runbooks, restore e rollback exercitados.

## Pós-GA

- NAT traversal direto com STUN/hole punching e Relay fallback;
- Kubernetes Operator, Gateway API e CRDs;
- SAML, SCIM, LDAP e device posture;
- geo-routing/Anycast;
- SDKs Go, Python, .NET, Java, Node e PHP;
- Terraform Provider;
- armazenamento analítico de inspeções em larga escala.
