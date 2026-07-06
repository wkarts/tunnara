# Relatório de validação — Tunnara Platform 2.0.0-rc.5

## Correção complementar do Rust workspace

O `cargo check --workspace --all-targets` falhava no `tunnara-quic-bridge` com `E0308`, porque o braço `Ok` do `match` devolvia `JoinHandle<()>` e o braço `Err` devolvia `()`. O `tokio::spawn` agora é executado dentro de um bloco, descartando explicitamente o handle e fazendo ambos os braços retornarem `()`.

Também foi removido o import não utilizado `SinkExt` do Coordinator.

Validações locais executadas após a correção:

- `git diff --check`;
- `npm run version:check`;
- `npm run repository:check`;
- `npm run validate:native-deps`;
- `npm run validate:node`;
- `npm run validate:shell`.

O ambiente local não possui a toolchain Cargo/Rust e não tem acesso externo para instalá-la. A confirmação compilada ocorre no mesmo job `Rust workspace check` que identificou a falha. A alteração corrige diretamente a incompatibilidade de tipos apontada pelo compilador.

## Diagnóstico do workflow pós-merge

### Runtime executables — todos os sistemas

O workspace usava `reqwest 0.13` com a feature `rustls-tls`. Essa feature não existe na série 0.13, impedindo a resolução do grafo Cargo antes da compilação.

### Desktop applications — todos os sistemas

O Console Tauri havia recebido upgrades maiores/pre-1.0 incompatíveis com o código existente:

- `rand 0.10` removeu/alterou APIs importadas pelo projeto;
- `sha2 0.11` alterou o tipo retornado e a formatação usada;
- `sha1 0.11` e `hmac 0.12` ficaram em gerações incompatíveis de traits `digest`.

### Android

O projeto usava AGP 9.2.1, mas o workflow instalava Gradle 8.10.2. O plugin recusou iniciar e informou mínimo 9.4.1.

### iOS

O Xcode resolvia o pacote remoto WireGuardKit antes da preparação local. O manifesto remoto declarava `swift-tools-version:5.3` enquanto usava APIs de PackageDescription mais recentes. O bridge Go externo também não estava integrado ao projeto gerado.

### Containers

Somente `quic-bridge` falhou. Ele compila o workspace Rust e herdou a mesma configuração inválida de `reqwest`. As demais imagens progrediram normalmente.

## Correções

- `reqwest 0.13`: feature alterada para `rustls`;
- Tauri: `rand 0.8.5`, `sha2 0.10.9`, `sha1 0.10.6` e `hmac 0.12.1` fixados;
- Android: Gradle 9.4.1 alinhado ao AGP 9.2.1;
- iOS: WireGuardKit clonado e corrigido antes do XcodeGen/SwiftPM;
- iOS: Package.swift atualizado idempotentemente para tools 5.9;
- iOS: target externo WireGuardGoBridgeiOS e toolchain Go integrados;
- Docker Actions atualizadas para buildx v4, metadata v6 e build-push v7;
- adicionado `validate:native-deps`;
- Pull Request passa a executar `cargo check` do workspace e do Console Tauri.

## Validações aprovadas localmente

- `npm ci` na raiz e no Console;
- `npm run repository:check`;
- `npm run version:check` e `version:test`;
- `npm run validate:node`, `validate:shell`, `validate:php`;
- `npm run validate:storage`, `validate:release`, `validate:native-deps`;
- `npm run validate:sea`, `validate:docker`, `validate:mobile`;
- HTTP, WebSocket, TCP, UDP, Cloudflare, HA, WireGuard e redes privadas;
- Policy Engine e Request Inspector;
- SDK C compartilhado e estático;
- Console Vue/TypeScript e build Vite;
- Agent e Server SEA Linux x64;
- E2E executado com os binários standalone;
- preparação WireGuardKit executada duas vezes para confirmar idempotência.

## Limites do ambiente

O ambiente local não possuía Cargo/Rust, Docker Engine, Android SDK ou Xcode. Consequentemente, não são apresentados como executados localmente:

- os quatro builds Rust/Tauri nativos;
- a imagem Docker multi-arquitetura;
- APK/AAB;
- IPA e aplicativo de simulador.

As causas exatas que bloqueavam esses runners foram corrigidas e agora possuem preflights no Pull Request. A confirmação final ocorre em uma nova execução do GitHub Actions sobre a RC.5.
