# Manifesto de artefatos — Tunnara Platform 1.1.0

## Assets centrais

- `tunnara-platform-v1.1.0-source.zip`
- `tunnara-platform-v1.1.0-source.tar.gz`
- `tunnara-platform-v1.1.0-github-ready.zip`
- `tunnara-platform-v1.1.0-git-repository.bundle`
- `tunnara-platform-v1.1.0-complete.zip`
- `tunnara-console-web-v1.1.0.zip`
- `tunnara-runtime-linux-x64-v1.1.0.zip`
- `tunnara-runtime-linux-x64-v1.1.0.tar.gz`
- `tunnara-sdk-c-linux-x64-v1.1.0.zip`
- `Tunnara-Docker-v1.1.0.zip`
- `release-manifest.json`
- `SHA256SUMS.txt`

## Assets multiplataforma gerados pelo GitHub Actions

- Runtime Agent, Server e QUIC Bridge para Linux x64, Windows x64, macOS ARM64 e macOS x64.
- SDK C para Linux x64, Windows x64, macOS ARM64 e macOS x64.
- Instaladores Tauri para Linux, Windows e macOS.
- APK/AAB Android e IPA/simulador iOS conforme disponibilidade de assinatura.
- Imagens OCI `amd64` e `arm64` para Server, Agent, Console, Control API, QUIC Bridge e Caddy Cloudflare.

## Bundle Docker

`Tunnara-Docker-v1.1.0.zip` contém:

- Compose Community single-node;
- Compose de produção Cloudflare/ACME/QUIC;
- Compose HA;
- perfis SQLite/PostgreSQL/MySQL/Redis da Control API;
- scripts de instalação, atualização, diagnóstico, backup e restore;
- documentação operacional.

## Política de release

A release permanece em draft até que os assets centrais e todos os builds obrigatórios terminem. Os arquivos são anexados diretamente à GitHub Release; o pipeline não utiliza Actions Artifact Storage.
