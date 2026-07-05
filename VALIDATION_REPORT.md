# Relatório de validação — Tunnara Platform 1.1.0

Data: 5 de julho de 2026.

## Escopo auditado

- runtime Node.js: Control, Edge, Relay e Agent;
- Console Vue/Tauri;
- SDK C;
- Control API Laravel;
- Docker Community, produção, HA e storage;
- Cloudflare, ACME/Let’s Encrypt e QUIC;
- workflows de CI, release, containers, desktop, mobile e SDK;
- scripts de versionamento e empacotamento.

## Validações concluídas localmente

- repositório limpo e sem segredos operacionais;
- SemVer `1.1.0` sincronizado em 23 pontos e build mobile `10100`;
- sintaxe Node.js, Bash e PHP;
- parse de todos os YAML dos workflows e composições Docker;
- validação estática das imagens, tags, overrides e comandos Docker;
- runtime HTTP/POST/headers/query string/WebSocket;
- TCP e UDP ponta a ponta;
- token descartável, scopes, Ed25519, nonce, replay e revogação;
- integração Cloudflare simulada, wildcard e lifecycle de subdomínio;
- multi-edge/multi-relay e failover;
- WireGuard e redes privadas em ambiente controlado;
- backup, restore e diagnóstico SQLite;
- SDK C dinâmico e estático com smoke test;
- typecheck Vue/TypeScript;
- build web minificado com lazy loading e chunks separados;
- validação dos perfis SQLite, memory, PostgreSQL, MySQL, local, database e Redis;
- validação do pipeline de release draft e reusable workflows;
- ausência de `actions/upload-artifact`, `actions/download-artifact`, `macos-13` e `macos-14` nos workflows;
- instalação limpa npm: 4 pacotes na raiz e 57 no Console.

## Resultado do Console

O bundle monolítico anterior foi substituído por carregamento sob demanda. Os principais chunks de entrada ficaram aproximadamente em:

- aplicação: 85,60 kB;
- Vue/Router/Pinia: 95,85 kB;
- Tauri API: 1,71 kB;

Sourcemaps de produção ficam desabilitados por padrão e podem ser ativados com `TUNNARA_CONSOLE_SOURCEMAP=true`.

## Validações delegadas ao GitHub Actions

O ambiente local não possui Docker Engine, Cargo/Rust, Composer, Android SDK ou macOS/Xcode. Permanecem cobertos pelos workflows:

- build do QUIC Bridge Rust em Linux, Windows e macOS;
- build dos serviços/crates Rust;
- testes Laravel com Composer e matriz SQLite/PostgreSQL/MySQL/Redis;
- build e push das imagens OCI `amd64`/`arm64`;
- instaladores Tauri;
- APK/AAB Android;
- IPA e aplicativo iOS Simulator;
- assinatura e publicação opcional nas lojas.

## Limites de validação externa

Não foram executados sem credenciais do proprietário:

- alteração de uma zona Cloudflare real;
- emissão real de certificado Let’s Encrypt;
- publicação no GHCR;
- assinatura Windows/macOS/Android/iOS;
- publicação Google Play, TestFlight ou App Store.

## Conclusão

A versão 1.1.0 está preparada para Pull Request e release coordenada. A release permanece em draft quando qualquer build obrigatório falha e é retomada automaticamente quando uma execução encontra a mesma versão ainda em draft. Releases já publicadas somente são reconstruídas com `force_rebuild=true`.
