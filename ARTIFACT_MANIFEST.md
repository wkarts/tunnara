# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.6

## Pacotes desta correção

- `Tunnara-Platform-v2.0.0-rc.6-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.6-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.6.patch`
- `Tunnara-Platform-v2.0.0-rc.6.diff`
- `Tunnara-Platform-v2.0.0-rc.6-Arquivos-Alterados.zip`
- `Tunnara-Platform-v2.0.0-rc.6-PR-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.6-Pull-Request.md`
- `Tunnara-Platform-v2.0.0-rc.6-Relatorio-Validacao.md`
- `Tunnara-Platform-v2.0.0-rc.6-SHA256SUMS.txt`

## Correções centrais

1. versão Tauri específica do Windows convertida para prerelease MSI numérica;
2. substituição explícita de assets existentes antes do upload;
3. Packet Tunnel iOS usando o parser wg-quick local;
4. validadores preventivos para impedir regressão.

## Política

- Pull Requests não publicam artefatos de distribuição;
- releases e tags publicadas são imutáveis;
- cada nova correção pós-merge recebe uma nova versão;
- todos os jobs de uma release compilam o mesmo SHA;
- a publicação final somente ocorre após sucesso integral dos grupos obrigatórios.
