# Changelog

## 1.1.2

### Correções pós-merge e release

- Corrigida a feature TLS do `reqwest 0.13` no workspace Rust (`rustls`) e alinhado o MSRV/imagem QUIC para Rust 1.85, eliminando a falha de resolução e a incompatibilidade posterior de toolchain.
- Restauradas versões compatíveis de `rand`, `sha1` e `sha2` no Console Tauri, eliminando conflitos de API e de versões do crate `digest`.
- Alinhado Android Gradle Plugin 9.2.1 com Gradle 9.4.1 e incluído smoke build Android em Pull Requests.
- Corrigida a resolução do WireGuardKit no iOS por checkout local fixado, ajuste determinístico de `swift-tools-version` para 5.5 e target legado Xcode para compilar o bridge `wireguard-go` com Go 1.19.
- Adicionadas compilações reais do workspace Rust, Console Tauri, Android e aplicativo iOS Simulator ao CI de Pull Requests.
- Atualizadas GitHub Actions para runtimes Node 24 e isolado o cache Docker por imagem da matriz.
- Reconfigurado Dependabot para agrupar atualizações minor/patch, limitar PRs simultâneos e bloquear majors automáticos sem migração validada.

## 1.1.1

- Adicionados exemplos Docker Compose explícitos para ambiente local e VPS.
- Adicionado exemplo de VPS com Cloudflare, Let's Encrypt, HTTP/3 e Relay QUIC.
- Adicionados modelos de ambiente separados para local e VPS.
- Adicionado guia operacional passo a passo para Docker em VPS.
- Validação de repositório passa a exigir os exemplos e a documentação Docker.
- Documentada de forma explícita a separação entre runtime SQLite/memory e Control API PostgreSQL/MySQL/Redis.
- Adicionado relatório técnico de lacunas para paridade com ngrok e Pangolin.

## [Unreleased]

## [1.1.0] - 2026-07-05

### Docker e operação

- Adicionado bundle `Tunnara-Docker-v1.1.0.zip` instalável diretamente a partir da GitHub Release.
- Stack Community passou a consumir imagens publicadas no GHCR por padrão, com override separado para build local.
- Adicionados comandos `quickstart`, `quickstart-build`, `doctor`, `health`, `update`, `backup`, `restore` e `up-production`.
- Incluídos instalador por GitHub Release, preservação do `.env`, health checks e atualização segura com backup SQLite.
- Documentados os perfis SQLite/memory do runtime embarcado e SQLite/PostgreSQL/MySQL com Redis/local/database da Control API Laravel.
- Corrigido o fluxo de atualização para não solicitar `--build` quando o deploy utiliza imagens publicadas.

### Releases e GitHub Actions

- A release agora é coordenada em uma única execução por reusable workflows e permanece em draft até Runtime, SDK, Desktop, Mobile e Containers terminarem.
- Eliminada a dependência de eventos de tag criados pelo `GITHUB_TOKEN` e de Actions Artifact Storage.
- Publicação de imagens GHCR adicionada para Server, Agent, Console, Control API, QUIC Bridge e Caddy Cloudflare.
- Matrizes macOS atualizadas para `macos-15` e `macos-15-intel`; `macos-13` e `macos-14` foram removidos.
- Validação de PR permanece rápida, sem empacotamento nem geração de artefatos de distribuição.
- Adicionados validadores dedicados para pipeline de release e estrutura Docker.

### Console e dependências

- Páginas do Console passaram a usar carregamento sob demanda por rota.
- Build de produção voltou a usar minificação, divisão de chunks e sourcemap opcional.
- Bundle inicial reduzido e distribuído entre chunks Vue, Tauri e páginas funcionais.
- Dependências não utilizadas do `semantic-release` foram removidas, reduzindo a instalação raiz para 4 pacotes e a do Console para 57 pacotes.
- Instalação limpa validada em aproximadamente 1 segundo na raiz e 2 segundos no Console no ambiente de validação.

### Versionamento e documentação

- Sincronização SemVer ampliada para imagens Docker, `.env`, Control API e builds mobile.
- README, guias de Docker, produção, storage e release foram consolidados para o fluxo real da plataforma.
- Removidas instruções históricas de patches e branches da documentação principal.

## [1.0.1] - 2026-07-05

### Mobile e distribuição

- Builds Android e iOS separados da publicação nas lojas.
- APK debug instalável gerado mesmo sem keystore de produção.
- APK release e AAB sem assinatura gerados quando não há secrets.
- Aplicativo iOS Simulator e IPA `iphoneos` sem assinatura gerados sem Apple Developer.
- IPA assinado gerado automaticamente quando certificado e provisioning profiles estão disponíveis.
- Publicações Google Play e TestFlight opcionais, desabilitadas por padrão e isoladas dos jobs de build.
- Sincronização automática de `versionCode`, `CFBundleVersion` e versões dos projetos mobile.
- Correção do workflow de executáveis que compilava o QUIC Bridge duas vezes em diretórios diferentes.

## [1.0.0] - 2026-07-05

### Adicionado

- Túneis HTTP/HTTPS, WebSocket, TCP e UDP.
- Integração Cloudflare com API Token restrito, zona, DNS base, wildcard e subdomínio por túnel.
- Caddy com Let’s Encrypt DNS-01, renovação automática e HTTP/3.
- Cloudflare Tunnel opcional por QUIC.
- Transporte QUIC/TLS 1.3 Agent–Relay por bridge nativo Rust.
- Multi-edge, multi-relay, heartbeat, descoberta, presença e failover.
- Redes privadas WireGuard, peers, mesh/hub-spoke e lifecycle no Agent.
- SDK C ABI e unit Delphi funcionais.
- Projetos Android e iOS para redes privadas.
- Fluxo `up-production`, preflight, backup/restore e diagnóstico.
- Workflows de CI, release, GHCR, desktop, SDK e mobile.

### Segurança

- Ed25519 no handshake Agent/Relay, nonce, timestamp e proteção contra replay.
- Tokens persistidos somente por hash e segredos de integração criptografados.
- Escopo por organização e scopes mínimos.
- Destinos remotos bloqueados no Agent por padrão.
- Tokens Cloudflare não retornam pela API após persistidos.

## [0.2.1] - 2026-07-05

- Primeiro vertical slice HTTP/WebSocket e preparação GitHub-ready.

### Correções de CI e armazenamento da primeira publicação

- removidos builds de SDK, runtime e mobile das validações de pull request;
- removido definitivamente o runner `macos-13/macOS x64`;
- binários de release passam a ser anexados diretamente à GitHub Release, sem Actions Artifact Storage;
- adicionado workflow manual de limpeza de artifacts antigos;
- normalizados os lockfiles para `registry.npmjs.org` e ativado cache/retry do npm;
- corrigidas permissões de scripts mobile e validações sem geração de APK/IPA em PR;
- CodeQL deixa de bloquear PR privado sem Code Scanning habilitado;
- adicionada matriz agendada/manual para SQLite, PostgreSQL, MySQL e Redis;
- Control API passa a suportar SQLite, PostgreSQL e MySQL com cache/sessão/fila em memória, arquivos, banco ou Redis;
- runtime embarcado passa a aceitar `TUNNARA_STORAGE_DRIVER=sqlite|memory`;
- composição HA deixa de compartilhar SQLite entre dois processos Control.
