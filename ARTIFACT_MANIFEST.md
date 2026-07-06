# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.5

## Pacotes centrais

- `Tunnara-Platform-v2.0.0-rc.5-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.5-Pacote-Completo.zip`
- `Tunnara-Platform-v2.0.0-rc.5-Codigo-Fonte.zip`
- `Tunnara-Platform-v2.0.0-rc.5-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.5-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.5-PR-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.5.patch`
- `Tunnara-Platform-v2.0.0-rc.5-Arquivos-Alterados.zip`

## Distribuição local validada

- `Tunnara-Console-Web-v2.0.0-rc.5.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.5.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.5.tar.gz`
- `Tunnara-SDK-C-Linux-x64-v2.0.0-rc.5.zip`
- `Tunnara-Docker-v2.0.0-rc.5.zip`
- `Tunnara-Helm-v2.0.0-rc.5.zip`
- `Tunnara-Platform-v2.0.0-rc.5-SHA256SUMS.txt`

## Correção central

Os logs pós-merge mostraram quatro falhas independentes:

1. Runtime e `quic-bridge`: `reqwest 0.13` configurado com a feature removida `rustls-tls`.
2. Desktop Tauri: upgrades incompatíveis de `rand`, `sha2`, `sha1` e `hmac` sem adaptação do código.
3. Android: AGP 9.2.1 executado com Gradle 8.10.2, abaixo do mínimo 9.4.1.
4. iOS: SwiftPM tentava compilar o WireGuardKit remoto antes de aplicar os patches locais e sem o bridge Go externo integrado.

A RC.5 corrige as quatro causas na origem e adiciona validações preventivas no Pull Request.

## Conteúdo do pacote completo

- código-fonte sem caches, bancos, segredos ou dependências reconstruíveis;
- Console Web compilado;
- Agent e Server standalone Linux x64;
- SDK C dinâmico e estático Linux x64;
- Docker single-node, produção, distribuído TCP e distribuído QUIC;
- Control API, serviços Rust, Console Tauri e projetos mobile;
- observabilidade, Helm, documentação, OpenAPI, testes e workflows.

## Política de confiança

- Pull Requests não publicam artefatos;
- releases e tags publicadas são imutáveis;
- todos os jobs de uma release compilam o mesmo SHA;
- dependências nativas críticas são fixadas e verificadas;
- builds finais Windows/macOS/Android/iOS e containers são confirmados nos runners nativos do GitHub Actions.
