# Manifesto de artefatos — Tunnara Platform 1.1.2

## Assets centrais

- `tunnara-platform-v1.1.2-source.zip`
- `tunnara-platform-v1.1.2-source.tar.gz`
- `tunnara-platform-v1.1.2-github-ready.zip`
- `tunnara-platform-v1.1.2-git-repository.bundle`
- `tunnara-platform-v1.1.2-complete.zip`
- `tunnara-console-web-v1.1.2.zip`
- `tunnara-runtime-linux-x64-v1.1.2.zip`
- `tunnara-runtime-linux-x64-v1.1.2.tar.gz`
- `tunnara-sdk-c-linux-x64-v1.1.2.zip`
- `Tunnara-Docker-v1.1.2.zip`
- `release-manifest.json`
- `SHA256SUMS-core.txt`

## Assets multiplataforma gerados pelo GitHub Actions

- Runtime Agent, Server e QUIC Bridge para Linux x64, Windows x64, macOS ARM64 e macOS x64.
- SDK C para Linux x64, Windows x64, macOS ARM64 e macOS x64.
- Instaladores Tauri para Linux, Windows e macOS.
- APK/AAB Android e IPA/simulador iOS conforme disponibilidade de assinatura.
- Metadados mobile separados em `build-metadata-android.json` e `build-metadata-ios.json`.
- Checksums mobile separados em `SHA256SUMS-android.txt` e `SHA256SUMS-ios.txt`.
- Imagens OCI `amd64` e `arm64` para Server, Agent, Console, Control API, QUIC Bridge e Caddy Cloudflare.

## Bundle Docker

`Tunnara-Docker-v1.1.2.zip` contém:

- Compose Community single-node;
- Compose de produção Cloudflare/ACME/QUIC;
- Compose HA;
- perfis SQLite/PostgreSQL/MySQL/Redis da Control API;
- scripts de instalação, atualização, diagnóstico, backup e restore;
- documentação operacional.

## Política de release

A release permanece em draft até que os assets centrais e todos os builds obrigatórios terminem. Os arquivos são anexados diretamente à GitHub Release; o pipeline não utiliza Actions Artifact Storage.
