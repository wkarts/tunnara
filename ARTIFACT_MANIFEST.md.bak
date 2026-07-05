# Manifesto de artefatos — Tunnara Platform 1.0.1

## Pacotes de distribuição

- `Tunnara-Platform-v1.0.1-GitHub-Ready.zip`: repositório limpo para publicação.
- `Tunnara-Platform-v1.0.1-Git-Repository.bundle`: branch `main` e tag `v1.0.1`.
- `Tunnara-Platform-v1.0.1-Pacote-Completo.zip`: fontes, Console compilado, runtime e SDK C Linux.
- `Tunnara-Platform-v1.0.1-Codigo-Fonte.zip` e `.tar.gz`.
- `Tunnara-Console-Web-v1.0.1.zip`.
- `Tunnara-Runtime-Linux-x64-v1.0.1.zip` e `.tar.gz`.
- `Tunnara-SDK-C-Linux-x64-v1.0.1.zip`.
- `Tunnara-Platform-v1.0.1-SHA256SUMS.txt`.

## Distribuição mobile pelo GitHub Actions

Os binários mobile são gerados após o upload do repositório:

### Android sem secrets

- `Tunnara-Android-v1.0.1-debug-installable.apk`;
- `Tunnara-Android-v1.0.1-release-unsigned.apk`;
- `Tunnara-Android-v1.0.1-release-unsigned.aab`.

### Android com secrets de assinatura

- `Tunnara-Android-v1.0.1-release-signed.apk`;
- `Tunnara-Android-v1.0.1-release-signed.aab`.

### iOS sem secrets

- `Tunnara-iOS-v1.0.1-simulator-app.zip`;
- `Tunnara-iOS-v1.0.1-unsigned.ipa`.

### iOS com certificado e perfis

- `Tunnara-iOS-v1.0.1-<método>-signed.ipa`.

A publicação nas lojas é opcional e não faz parte do job de compilação.

## Componentes

- Control, Edge, Relay e Agent runtime.
- QUIC crate e QUIC Bridge Rust.
- Console Vue/Tauri.
- Cloudflare, ACME/Let’s Encrypt e Caddy HTTP/3.
- TCP/UDP, WireGuard e redes privadas.
- Multi-edge/multi-relay e HA.
- SDK C e Delphi.
- Clientes Android e iOS.
- Docker, CloudPanel, native, systemd e GitHub Actions.

## Binários locais incluídos

- `tunnara-agent-linux-x64`;
- `tunnara-server-linux-x64`;
- `libtunnara.so` e `libtunnara.a`.

Os artefatos Android/iOS são gerados nos runners oficiais, pois Android SDK e Xcode não estão disponíveis no ambiente Linux utilizado para montar este pacote.
