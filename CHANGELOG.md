# Changelog

## [2.0.0-rc.1] - 2026-07-06

### Plano de controle distribuído

- Adicionado perfil Laravel com PostgreSQL ou MySQL como fonte persistente e Redis para cache, sessões e filas.
- Adicionados provisionamento descartável, sessões de Agent, autenticação Ed25519, nonce, presença, nodes, rotas internas e atualização de saúde de targets.
- Adicionadas duas instâncias Control, dois Edges e dois Relays no Compose distribuído, com balanceamento interno pelo Caddy.
- Mantido o runtime embedded SQLite/memory para Community single-node.

### Policy Engine e identidade no Edge

- Adicionados matchers por método, caminho, regex, host, CIDR e headers.
- Adicionadas ações allow, deny, redirect, rate limit, Basic Auth, API key, JWT/OIDC, rewrite e transformação de headers.
- Adicionadas validações defensivas, limites estruturais e proteção contra expressões regulares arriscadas.
- Adicionado fuzzing automatizado do Policy Engine.

### Request Inspector

- Captura opcional de requests e responses por túnel.
- Redação automática de Authorization, cookies e campos sensíveis.
- Limites de body, retenção e quantidade máxima de registros.
- Replay controlado de requisições preservando método, path e headers permitidos.
- Interface administrativa no Console.

### Roteamento e resiliência

- Múltiplos targets por túnel.
- Prioridade, peso, health checks, limiares de falha/recuperação e failover.
- Métricas por túnel, target, política e status.
- Manutenção automática de auditoria e inspeções.

### Observabilidade e operação

- Endpoint Prometheus.
- Stack Prometheus/Grafana e dashboard inicial.
- Helm Chart com HPA, PDB, NetworkPolicy, ServiceMonitor, PVC, Ingress e Secrets.
- OpenAPI da série 2.0.
- Workflows noturnos de fuzzing e carga sem geração de artefatos.

### Console e SDKs

- Páginas funcionais para Policies e Request Inspector.
- Túneis com seleção de política, Inspector, targets e saúde.
- SDK C ABI e runtime standalone Linux recompilados para a versão RC.

### Validação

- Suite funcional HTTP/WebSocket/TCP/UDP, Cloudflare, failover distribuído, WireGuard, redes privadas e Policy Engine aprovada.
- 3.000 iterações de fuzzing sem falhas não tratadas.
- Benchmark local: 1.000 requests, concorrência 50, zero falhas, aproximadamente 548,87 req/s e p95 de 107,81 ms no ambiente de validação.
- E2E HTTP/WebSocket aprovado também contra executáveis standalone Linux.

### Classificação

A versão é um Release Candidate para homologação e produção controlada. A promoção para GA depende de testes multi-host prolongados, domínio real, dispositivos físicos e auditoria externa documentados em `docs/security/MATURITY_GATES.md`.

## [1.1.1] - 2026-07-05

- Adicionados exemplos Docker Compose explícitos para ambiente local e VPS.
- Adicionado exemplo de VPS com Cloudflare, Let's Encrypt, HTTP/3 e Relay QUIC.
- Adicionados modelos de ambiente separados para local e VPS.
- Adicionado guia operacional passo a passo para Docker em VPS.
- Documentada a separação entre runtime SQLite/memory e Control API PostgreSQL/MySQL/Redis.

## [1.1.0] - 2026-07-05

- Docker Community e produção, releases coordenadas, GHCR e otimizações do Console.
- Providers SQLite, PostgreSQL, MySQL e Redis documentados e validados.

## [1.0.1] - 2026-07-05

- Builds mobile independentes da publicação nas lojas.
- Correções de CI, assinatura opcional e sincronização de versões mobile.

## [1.0.0] - 2026-07-05

- HTTP/HTTPS/WebSocket/TCP/UDP, Cloudflare, ACME, QUIC Bridge, WireGuard, SDKs e distribuição inicial.

## [0.2.1] - 2026-07-05

- Primeiro vertical slice HTTP/WebSocket e preparação GitHub-ready.
