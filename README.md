# Tunnara Platform 2.0.0-rc.1

A Tunnara é uma plataforma self-hosted de conectividade segura para publicar aplicações atrás de NAT/CGNAT, operar túneis HTTP/HTTPS/WebSocket/TCP/UDP, criar redes privadas WireGuard e administrar acesso por políticas.

A série 2.0 consolida o runtime funcional, o Control API distribuído, Policy Engine, Request Inspector, múltiplos targets, health checks, failover, métricas, Docker, Kubernetes e SDKs em uma única distribuição.

## Recursos entregues

- Control, Edge, Relay e Agent.
- HTTP, HTTPS, WebSocket, TCP e UDP.
- Agent–Relay por TCP/TLS ou QUIC/TLS 1.3.
- Cloudflare DNS e subdomínios automáticos.
- Let’s Encrypt DNS-01, wildcard, HTTP/2 e HTTP/3.
- Policy Engine: deny/allow, Basic Auth, API key, JWT/OIDC, rate limit, headers, redirects e rewrite.
- Request Inspector com redação, retenção e replay.
- Múltiplos targets por túnel, prioridade, peso, health check e failover.
- Multi-edge e multi-relay com registro, heartbeat e presença.
- Redes privadas WireGuard.
- PostgreSQL/MySQL/SQLite e Redis/local/memory.
- Prometheus, Grafana e métricas por túnel/target/policy.
- Docker Compose single-node e distribuído.
- Helm Chart, HPA, PDB, NetworkPolicy e ServiceMonitor.
- Console Vue 3/Tauri.
- SDK C ABI e Delphi; projetos Android e iOS.

## Escolha do perfil

### Community single-node

Indicado para laboratório, desenvolvimento, pequenas instalações e uma única VPS.

```bash
git clone https://github.com/wkarts/tunnara.git
cd tunnara
./docker.sh quickstart
```

Serviços padrão:

```text
Console: http://IP_DA_VPS:7400
Control: http://127.0.0.1:7100
Edge:    http://IP_DA_VPS:8080
Relay:   tcp://IP_DA_VPS:7300
```

### Produção com Cloudflare, ACME e QUIC

```bash
cd deploy/docker
./tunnara.sh init
# edite .env com domínio, IP público, e-mail ACME e token Cloudflare
./tunnara.sh preflight
./tunnara.sh up-production
```

### Plano distribuído PostgreSQL/Redis

O perfil distribuído usa duas instâncias do Control API, PostgreSQL como fonte de verdade, Redis para cache/sessões/filas, dois Edges e dois Relays.

```bash
cd deploy/docker
./tunnara.sh init
# configure TUNNARA_BASE_DOMAIN, TUNNARA_PUBLIC_HOST,
# CLOUDFLARE_API_TOKEN e TUNNARA_ACME_EMAIL
./tunnara.sh up-distributed
./tunnara.sh status-distributed
```

Detalhes: [`deploy/docker/distributed/README.md`](deploy/docker/distributed/README.md).

### Observabilidade

```bash
cd deploy/docker
./tunnara.sh up-observability
```

- Prometheus: `http://127.0.0.1:9090`
- Grafana: `http://127.0.0.1:3000`

### Kubernetes

```bash
helm upgrade --install tunnara deploy/helm/tunnara \
  --namespace tunnara --create-namespace \
  --set-string server.adminToken='tnr_admin_...' \
  --set-string server.masterKey='...' \
  --set-string server.clusterToken='tnr_cluster_...'
```

Consulte [`deploy/helm/tunnara/README.md`](deploy/helm/tunnara/README.md).

## CLI

```bash
tunnara login --token TOKEN --control-url https://control.tunnel.exemplo.com.br
tunnara serve

tunnara http 8080 --domain erp.tunnel.exemplo.com.br --auto-dns
tunnara tcp 22 --remote-port 22022
tunnara udp 51820 --remote-port 25182

tunnara network list
tunnara network join UUID_DA_REDE
```

## Políticas e Request Inspector

O Policy Engine é executado no Edge antes do encaminhamento. Uma política pode combinar matchers e ações como:

```json
{
  "defaultAction": "deny",
  "rules": [
    {
      "match": { "pathPrefix": "/api", "methods": ["GET"] },
      "actions": [
        { "type": "jwt", "issuer": "https://id.exemplo.com", "audience": "tunnara" },
        { "type": "rate_limit", "requests": 120, "windowSeconds": 60 },
        { "type": "allow" }
      ]
    }
  ]
}
```

O Inspector captura requisição/resposta com limites e redação automática de credenciais. O replay preserva método, path, headers permitidos e body.

## Storage

| Perfil | Banco | Estado rápido |
|---|---|---|
| Embedded | SQLite ou memory | local/memory |
| Distribuído | PostgreSQL ou MySQL | Redis recomendado |
| Desenvolvimento | SQLite | file/array |

O Control API Laravel possui migrações e endpoints internos compatíveis com o runtime distribuído. SQLite continua disponível para Community single-node, mas não deve ser compartilhado entre múltiplos Controls.

## Desenvolvimento e validação

```bash
npm ci
npm --prefix apps/console ci
npm run validate
npm run runtime:test:security
npm run runtime:test:load
```

A CI de Pull Request não cria artefatos. Builds completos são executados por tag, release ou workflow manual.

## Estado da release

`2.0.0-rc.1` é um candidato de produção controlada. Os recursos funcionais estão integrados e possuem testes locais automatizados, mas a classificação GA exige domínio real, ensaio multi-host prolongado, teste em dispositivos físicos e auditoria de segurança externa. Consulte:

- [`docs/STATUS.md`](docs/STATUS.md)
- [`docs/architecture/COMPETITIVE_GAP.md`](docs/architecture/COMPETITIVE_GAP.md)
- [`docs/releases/v2.0.0-rc.1.md`](docs/releases/v2.0.0-rc.1.md)
- [`docs/security/MATURITY_GATES.md`](docs/security/MATURITY_GATES.md)

## Estrutura

```text
apps/        Console e Control API Laravel
runtime/     Runtime Server/Agent funcional
crates/      Núcleo e transportes Rust
services/    Serviços nativos
sdk/         C, Delphi, Android e iOS
deploy/      Docker, Helm, observabilidade e instalações nativas
docs/        Arquitetura, API, segurança e operação
tests/       carga e fuzzing
```

## Licenciamento

Consulte `LICENSE` e `LICENSE-NOTICE.md`.
