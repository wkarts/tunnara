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
