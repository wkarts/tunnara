# Relatório de validação — Tunnara Platform 2.0.0-rc.1

Data: 6 de julho de 2026.

## Resultado resumido

```text
REPOSITORY_OK
VERSION_OK (25 pontos; build mobile 20000)
NODE_SYNTAX_OK
BASH_SYNTAX_OK
PHP_SYNTAX_OK
STORAGE_PROFILES_OK
RELEASE_PIPELINE_OK
DOCKER_DEPLOYMENT_OK
HTTP_WEBSOCKET_OK
TCP_UDP_OK
CLOUDFLARE_DNS_OK
DISTRIBUTED_FAILOVER_OK
WIREGUARD_OK
PRIVATE_NETWORK_OK
PRODUCTION_CONFIG_OK
POLICY_INSPECTOR_HA_OK
SECURITY_FUZZ_OK
LOAD_OK
SDK_C_OK
CONSOLE_TYPECHECK_OK
CONSOLE_BUILD_OK
STANDALONE_LINUX_OK
```

## Funcionalidades exercitadas

- provisionamento descartável e sessão de Agent;
- prova Ed25519, nonce, timestamp, replay e revogação;
- isolamento por organização e tokens com abilities;
- HTTP, POST, query string, headers, body e WebSocket;
- TCP e UDP ponta a ponta;
- Cloudflare DNS por API simulada compatível;
- multi-edge/multi-relay e failover;
- WireGuard e redes privadas;
- Policy Engine com deny/allow, Basic Auth, rate limit e transformações;
- Request Inspector, redação, retenção e replay;
- múltiplos targets, prioridade, peso, health checks e failover;
- métricas Prometheus;
- backup, restore e diagnóstico SQLite;
- SDK C dinâmico/estático;
- Console Vue/TypeScript;
- executáveis standalone Linux.

## Fuzzing

O Policy Engine recebeu 3.000 documentos gerados com formatos, tipos e estruturas variados. O parser permaneceu controlado e não houve exceções não tratadas.

```json
{
  "iterations": 3000,
  "rejected": 0
}
```

## Benchmark local

Teste realizado no mesmo host entre Edge, Relay, Agent e upstream local:

```json
{
  "requests": 1000,
  "concurrency": 50,
  "completed": 1000,
  "failures": 0,
  "durationSeconds": 1.822,
  "requestsPerSecond": 548.87,
  "p50Ms": 87.72,
  "p95Ms": 107.81,
  "p99Ms": 156.23,
  "maxMs": 176.55
}
```

Esse resultado comprova o teste local, não capacidade global de produção.

## Console

- TypeScript/Vue sem erros.
- Build Vite concluído.
- Bundle principal: 86,03 kB.
- Vendor Vue/Router/Pinia: 95,85 kB.
- Policies e Request Inspector carregados em chunks independentes.

## Executáveis standalone

- `tunnara-agent-linux-x64`: criado e executado.
- `tunnara-server-linux-x64`: criado e executado.
- E2E HTTP/WebSocket completo aprovado usando os dois binários.

## Validações estáticas do plano distribuído

- sintaxe PHP de migrations, models, middleware, controllers, support e testes;
- Compose distribuído com PostgreSQL, Redis, dois Controls, dois Edges e dois Relays;
- migrações para provisionamento, sessões, nodes, presença, políticas, targets e inspeções;
- Helm e YAML parseados;
- OpenAPI parseada;
- workflows parseados e sem artifacts em PR.

## Validações que dependem de runners/credenciais externos

Não foram executadas localmente por indisponibilidade das ferramentas ou credenciais no ambiente:

- `composer install` e PHPUnit do Control API;
- compilação completa do workspace Rust/QUIC;
- execução real do Docker Engine e Helm CLI;
- imagens OCI amd64/arm64;
- instaladores Tauri;
- APK/AAB e IPA;
- Cloudflare e Let’s Encrypt em domínio real;
- assinatura e notarização.

Essas etapas estão configuradas nos workflows do GitHub, mas devem ser acompanhadas na primeira execução da RC.

## Classificação

A versão está apta para homologação e produção controlada. Não é uma certificação GA de escala global. Os gates restantes estão documentados em `docs/security/MATURITY_GATES.md`.
