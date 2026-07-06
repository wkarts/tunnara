# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.4

## Pacotes centrais

- `Tunnara-Platform-v2.0.0-rc.4-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.4-Pacote-Completo.zip`
- `Tunnara-Platform-v2.0.0-rc.4-Codigo-Fonte.zip`
- `Tunnara-Platform-v2.0.0-rc.4-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.4-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.4-PR-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.4.patch`
- `Tunnara-Platform-v2.0.0-rc.4-Arquivos-Alterados.zip`

## Distribuição

- `Tunnara-Console-Web-v2.0.0-rc.4.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.4.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.4.tar.gz`
- `Tunnara-SDK-C-Linux-x64-v2.0.0-rc.4.zip`
- `Tunnara-Docker-v2.0.0-rc.4.zip`
- `Tunnara-Helm-v2.0.0-rc.4.zip`
- `Tunnara-Platform-v2.0.0-rc.4-SHA256SUMS.txt`

## Correção central

A auditoria foi executada sobre a cópia local efetivamente enviada ao GitHub.
O erro era provocado por `deploy/docker/docker-compose.distributed.quic.yml`,
um overlay mantido de uma versão anterior com a imagem
`tunnara-quic-bridge:2.0.0-rc.2`.

O overlay foi promovido a perfil suportado, integrado ao launcher e incluído na
validação combinada do Docker Compose. Arquivos de backup, helpers órfãos e um
Compose antigo não utilizado foram removidos.

## Conteúdo do pacote completo

- código-fonte sem caches, bancos, segredos ou dependências reconstruíveis;
- Console Web compilado;
- Agent e Server standalone Linux x64;
- SDK C dinâmico e estático Linux x64;
- Docker single-node, produção, distribuído TCP e distribuído QUIC;
- backup, restore, update e rollback do perfil distribuído;
- observabilidade e Helm Chart;
- Control API Laravel, runtime, serviços Rust e projetos mobile;
- documentação, OpenAPI, testes, workflows e scripts de release.

## Política de CI e release

- Pull Requests não enviam artefatos ao GitHub Actions;
- arquivos `.bak`, `.orig` e `.rej` são rejeitados;
- Compose órfão em `deploy/docker` é rejeitado;
- tags fixas e fallbacks `${TUNNARA_VERSION:-...}` são validados;
- releases publicadas e tags existentes permanecem imutáveis;
- a versão desta correção é `2.0.0-rc.4`.
