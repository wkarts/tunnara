# Pull Request — Tunnara Platform 2.0.0-rc.1

## Branch

```text
release/v2.0.0-rc1-platform-hardening
```

## Commit

```text
feat: deliver Tunnara 2.0.0 RC platform hardening
```

## Título

```text
feat: lançar Tunnara 2.0.0 RC com policies, inspector, failover e Control Plane distribuído
```

## Descrição

### Contexto

Esta entrega consolida o amadurecimento da Tunnara em uma única Release Candidate. O objetivo é aproximar a plataforma da experiência funcional de soluções como ngrok e Pangolin sem depender dos protocolos proprietários desses produtos.

### Principais entregas

- Control Plane Laravel distribuído sobre PostgreSQL/MySQL e Redis.
- Provisionamento descartável, Agent sessions, Ed25519, nonce e proteção contra replay.
- Nodes, presença, heartbeat, descoberta e rotas internas para Edge/Relay.
- Policy Engine no Edge com allow/deny, Basic Auth, API key, JWT/OIDC, rate limit, redirects, rewrite e headers.
- Request Inspector com redação, retenção e replay.
- Múltiplos targets por túnel com prioridade, peso, health check e failover.
- Métricas Prometheus e stack Grafana.
- Docker single-node, produção, distribuído e observabilidade.
- Helm Chart com HPA, PDB, NetworkPolicy e ServiceMonitor.
- OpenAPI da série 2.0.
- Console integrado para Policies, Inspector, targets e saúde.
- Fuzzing do Policy Engine e benchmark local.
- Workflows de PR sem geração de artefatos.

### Compatibilidade e migração

- O runtime SQLite/memory permanece disponível para Community single-node.
- PostgreSQL/MySQL + Redis são usados no plano distribuído.
- A Tunnara mantém protocolo e agentes próprios; a compatibilidade pretendida é funcional, não binária.

### Validação executada

- HTTP/WebSocket/TCP/UDP.
- Cloudflare DNS.
- Multi-edge/multi-relay e failover.
- WireGuard e redes privadas.
- Policy Engine, Request Inspector, health checks e target failover.
- 3.000 iterações de fuzzing.
- 1.000 requests com concorrência 50 e zero falhas no benchmark local.
- SDK C.
- Console Vue/TypeScript.
- Agent e Server standalone Linux com E2E.
- Sintaxe PHP do Control API, YAML, JSON, TOML, Docker e workflows.

### Classificação

A versão é uma Release Candidate para homologação e produção controlada. A promoção para GA depende dos gates de domínio real, soak test multi-host, testes físicos mobile e auditoria externa descritos em `docs/security/MATURITY_GATES.md`.

## Squash and merge

```text
feat: release Tunnara Platform v2.0.0-rc.1
```
