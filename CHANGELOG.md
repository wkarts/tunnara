# Changelog

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
