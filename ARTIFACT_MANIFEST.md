# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.1

## Pacotes centrais

- `Tunnara-Platform-v2.0.0-rc.1-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.1-Pacote-Completo.zip`
- `Tunnara-Platform-v2.0.0-rc.1-Codigo-Fonte.zip`
- `Tunnara-Platform-v2.0.0-rc.1-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.1-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.1.patch`
- `Tunnara-Platform-v2.0.0-rc.1-Arquivos-Alterados.zip`

## Distribuição

- `Tunnara-Console-Web-v2.0.0-rc.1.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.1.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.1.tar.gz`
- `Tunnara-SDK-C-Linux-x64-v2.0.0-rc.1.zip`
- `Tunnara-Docker-v2.0.0-rc.1.zip`
- `Tunnara-Helm-v2.0.0-rc.1.zip`
- `Tunnara-Platform-v2.0.0-rc.1-SHA256SUMS.txt`

## Conteúdo do pacote completo

- código-fonte sem caches, bancos, segredos ou dependências reconstruíveis;
- Console Web compilado;
- Agent e Server standalone Linux x64;
- SDK C dinâmico e estático Linux x64;
- Docker single-node, produção, distribuído e observabilidade;
- Helm Chart;
- Control API Laravel, runtime, serviços Rust e projetos mobile;
- documentação, OpenAPI, testes, workflows e scripts de release.

## Artefatos produzidos pelo GitHub Actions

- Runtime Agent/Server e QUIC Bridge para Linux, Windows e macOS;
- SDK C para Linux, Windows e macOS;
- instaladores Tauri;
- APK/AAB e artefatos iOS compatíveis com as credenciais disponíveis;
- imagens OCI amd64/arm64 para Server, Agent, Console, Control API, QUIC Bridge e Caddy Cloudflare;
- SBOM, provenance e checksums quando habilitados no workflow de release.

## Política

Pull Requests não criam artefatos de distribuição. A release permanece em draft até a conclusão dos workflows obrigatórios e os arquivos finais são anexados diretamente à GitHub Release.
