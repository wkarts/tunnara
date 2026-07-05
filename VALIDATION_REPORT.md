# Relatório de validação — Tunnara Platform 1.0.1

Data: 5 de julho de 2026.

## Executado com sucesso neste ambiente

- limpeza e integridade do repositório;
- sincronização SemVer em 21 pontos e build mobile `10001`;
- sintaxe Node.js, Bash e PHP;
- parse dos workflows GitHub Actions;
- HTTP, POST, headers, query string e WebSocket/upgrade;
- autenticação Ed25519, replay, token descartável, scopes e revogação;
- TCP público e UDP público;
- integração Cloudflare simulada, zona, wildcard e lifecycle de subdomínio;
- registro distribuído, multi-relay e failover;
- WireGuard manager e redes privadas em ambiente controlado;
- validação da composição ACME DNS-01, HTTP/3 e QUIC;
- SDK C dinâmico/estático;
- typecheck Vue/TypeScript e build web;
- executáveis standalone Linux Agent e Server;
- scripts mobile sem erro de sintaxe;
- comportamento opcional de assinatura e publicação revisado estruturalmente.

## Validação delegada ao GitHub Actions

O ambiente local não contém Android SDK, Gradle, macOS/Xcode nem credenciais de assinatura. Os workflows executam:

- APK debug instalável;
- APK release e AAB sem assinatura quando não existem secrets;
- APK/AAB assinados quando o keystore existe;
- aplicativo iOS Simulator;
- build `iphoneos` e IPA sem assinatura;
- `.xcarchive` e IPA assinado quando certificado e provisioning profiles existem;
- publicação opcional no Google Play e TestFlight;
- build do QUIC Bridge em Linux, Windows e macOS;
- imagens Docker `amd64`/`arm64` e desktop Tauri.

## Garantia de independência das lojas

A ausência de credenciais Google ou Apple não falha os jobs de build. Os jobs de publicação são separados, opcionais e marcados como tolerantes a falha. Erros reais de compilação continuam falhando o build, como esperado.

## Dependências externas

Continuam dependentes do proprietário:

- emissão real do certificado Let’s Encrypt;
- alteração de zona Cloudflare real;
- assinatura Android/iOS/macOS/Windows;
- instalação de IPA em dispositivo físico;
- publicação em lojas, GHCR e App Store Connect.

# Relatório de validação — correção de CI e storage

Versão: `1.0.1`

## Problemas reproduzidos pelos logs

- `npm ci` tentava baixar pacotes de um registry interno indisponível no GitHub Actions;
- uploads falhavam por cota esgotada do Actions Artifact Storage;
- o job `macos-13/macOS x64` permanecia aguardando runner;
- scripts mobile falhavam com `Permission denied`;
- `cargo fmt --check` encontrou arquivos sem formatação;
- CodeQL em repositório privado falhava no envio de resultados;
- health check PostgreSQL era executado sem usuário/banco explícitos.

## Correções aplicadas

- lockfiles e `.npmrc` apontam para o registry público;
- instalação npm possui cache, timeout e repetição controlada;
- PR/commit não cria artifacts;
- releases usam arquivos da GitHub Release;
- `macos-13` foi removido;
- scripts mobile são chamados explicitamente com `bash`;
- CodeQL saiu do evento de PR e é opt-in em repositório privado;
- matriz de storage é agendada/manual e não bloqueia o PR;
- PostgreSQL, MySQL, SQLite e Redis foram configurados e documentados;
- migrações `json` e tabelas de runtime são portáveis;
- runtime embedded suporta SQLite e memória;
- compartilhamento de SQLite entre Controls no compose HA foi removido.

## Validações locais executadas

- sintaxe Node.js;
- sintaxe PHP;
- sintaxe Bash;
- parse dos YAML/JSON/TOML;
- busca por `macos-13`;
- busca por `actions/upload-artifact` e `actions/download-artifact` nos workflows;
- validação do runtime em SQLite e memória;
- testes end-to-end do runtime;
- typecheck e build Vue;
- build e smoke test do SDK C;
- verificação de registry nos lockfiles;
- integridade dos pacotes finais.

PostgreSQL, MySQL e Redis são validados pelo workflow `Storage compatibility matrix`, porque este ambiente local não possui Docker nem os drivers PDO correspondentes.
