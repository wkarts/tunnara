# Relatório de validação — Tunnara Platform 2.0.0-rc.2

Data: 6 de julho de 2026.

## Resultado resumido

```text
REPOSITORY_OK
VERSION_OK (25 pontos; build mobile 20000902)
NODE_SYNTAX_OK
BASH_SYNTAX_OK
PHP_SYNTAX_OK (49 arquivos)
YAML_OK (38 arquivos não-template)
STORAGE_PROFILES_OK
RELEASE_PIPELINE_OK
DOCKER_DEPLOYMENT_OK
MOBILE_CONFIG_OK
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
STANDALONE_E2E_OK
```

## Correções de hardening da RC2

- release coordenada, imutável e baseada na tag exata;
- upload sequencial e idempotente dos assets, sem Actions Artifact Storage;
- nomes exclusivos de checksums e metadados por plataforma;
- build SEA multiplataforma usando a API JavaScript do esbuild e postject sem wrappers `.cmd`;
- Desktop/Tauri associado ao `release_id` existente, sem criação de drafts paralelos;
- assinatura e notarização macOS realmente opcionais;
- Android compatível com AGP 9 e Kotlin integrado;
- iOS compatível com Xcode 16, WireGuardKit público e `Info.plist` gerado;
- build number mobile monotônico para versões alpha, beta, RC e estáveis;
- Docker distribuído com fallback TCP/TLS e overlay QUIC explícito;
- backup/restore PostgreSQL, update e rollback para os perfis distribuídos;
- runbooks de produção, desastre, incidentes, atualização e rollback;
- Dependabot agrupado e limitado para evitar atualizações major incompatíveis.

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
  "durationSeconds": 1.837,
  "requestsPerSecond": 544.39,
  "p50Ms": 86.78,
  "p95Ms": 123.74,
  "p99Ms": 190.62,
  "maxMs": 212.81
}
```

Esse resultado comprova apenas o cenário local executado. Não representa promessa de capacidade global ou substitui os testes quantitativos definidos para GA.

## Console

- TypeScript/Vue sem erros.
- Build Vite concluído em 1,61 s.
- Bundle principal: 86,03 kB.
- Vendor Vue/Router/Pinia: 95,85 kB.
- Policies e Request Inspector carregados em chunks independentes.

## Executáveis standalone

- `tunnara-agent-linux-x64`: criado e executado.
- `tunnara-server-linux-x64`: criado e executado.
- ambos reportaram `2.0.0-rc.2`;
- E2E HTTP/WebSocket completo aprovado usando diretamente os dois executáveis.

## Validações estáticas do plano distribuído

- sintaxe PHP de migrations, models, middleware, controllers, support e testes;
- Compose distribuído com PostgreSQL, Redis, dois Controls, dois Edges e dois Relays;
- overlay QUIC com exportação de certificados e UDP/7443;
- migrações para provisionamento, sessões, nodes, presença, políticas, targets e inspeções;
- workflows e arquivos Compose parseados;
- OpenAPI versionada;
- PRs sem criação de artefatos temporários.

## Validações que dependem de runners, infraestrutura ou credenciais externas

Não foram executadas localmente por indisponibilidade das ferramentas, plataformas ou credenciais no ambiente:

- `composer install` e PHPUnit completo do Control API;
- compilação completa do workspace Rust/QUIC;
- execução real do Docker Engine e Helm CLI;
- imagens OCI amd64/arm64;
- instaladores Tauri em Windows e macOS;
- APK/AAB e IPA;
- Cloudflare e Let’s Encrypt em domínio real;
- assinatura e notarização;
- testes físicos em Android/iOS;
- soak multi-host, caos, pentest e auditoria externa.

Essas etapas estão configuradas ou documentadas, mas precisam ser acompanhadas na primeira execução da RC e concluídas antes da promoção para GA.

## Classificação

A versão está apta para GitHub, homologação e produção controlada. Ela não é uma certificação GA de escala global. Os gates restantes estão documentados em `docs/security/MATURITY_GATES.md` e `docs/operations/PRODUCTION_READINESS.md`.
