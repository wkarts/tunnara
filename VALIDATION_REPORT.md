# Relatório de validação — Tunnara Platform 1.1.2

Data: 6 de julho de 2026.

## Incidente analisado

O release pós-merge falhou em múltiplas matrizes após atualizações major abertas pelo Dependabot. O CI anterior validava principalmente sintaxe/configuração e não compilava o workspace Rust, o backend Tauri nem os aplicativos mobile nos Pull Requests correspondentes.

## Causas corrigidas

- `reqwest 0.13` não oferece a feature antiga `rustls-tls`; o workspace passou a usar `rustls`.
- `reqwest 0.13.4` exige Rust 1.85; o MSRV e a imagem builder do QUIC Bridge foram alinhados para 1.85.
- O Console utilizava APIs de `rand 0.8`, `sha1/sha2 0.10` e `digest 0.10`, mas os manifests haviam sido elevados para versões incompatíveis.
- Android Gradle Plugin 9.2.1 estava sendo executado com Gradle 8.10.2; o workflow agora usa Gradle 9.4.1.
- O tag fixado do WireGuardKit declara Swift Tools 5.3, embora use plataformas introduzidas no PackageDescription 5.5. O checkout local é corrigido de forma determinística.
- O bridge `wireguard-go` não pode ser construído automaticamente pelo Swift Package Manager; foi incluído um target legado Xcode que executa `/usr/bin/make` com os build settings da arquitetura/SDK e Go 1.19.
- O cache Docker da matriz usava escopo compartilhado; agora cada imagem possui escopo próprio.

## Endurecimento do CI

- `cargo check --workspace --all-targets` em alterações Rust.
- `cargo check` do backend Tauri com todas as features de storage.
- build Android `:app:assembleDebug` em alterações mobile.
- resolução do WireGuardKit e build real do aplicativo iOS Simulator.
- validação mobile também no CI central e antes da criação dos artefatos de release.
- Dependabot agrupado para minor/patch, com limite de PRs e majors bloqueados até migração dedicada.

## Validações concluídas localmente

- instalação limpa npm: 4 pacotes na raiz e 59 no Console;
- integridade do repositório e SemVer `1.1.2` sincronizado;
- sintaxe Node.js, Bash e PHP;
- parse YAML dos workflows e do Dependabot;
- storage, release, Docker e configuração mobile;
- runtime HTTP/WebSocket, TCP/UDP, Cloudflare, HA/failover, WireGuard, rede privada e configuração de produção;
- SDK C dinâmico/estático e smoke test;
- Vue/TypeScript typecheck;
- build Vite de produção.

## Validações delegadas ao GitHub Actions

Este ambiente local não possui Cargo/Rust, Docker Engine, Gradle/Android SDK ou macOS/Xcode. Portanto, não foi possível executar localmente:

- compilação nativa Rust/QUIC Bridge;
- imagens OCI multi-arquitetura;
- APK/AAB Android;
- aplicativo/IPA iOS e bridge WireGuardGo;
- instaladores Tauri.

Essas lacunas deixaram de ser apenas validações estáticas: os workflows de Pull Request agora executam compilação Rust, Android e iOS antes do merge. O resultado definitivo desses targets deve ser confirmado pelo GitHub Actions da branch de correção.

## Resultado

A base foi elevada para `1.1.2`, as causas observadas no log foram corrigidas e o pipeline passou a impedir que atualizações incompatíveis sejam consideradas verdes sem compilar os módulos afetados.
