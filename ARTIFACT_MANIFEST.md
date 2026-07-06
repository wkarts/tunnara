# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.7

## Pacotes

- `Tunnara-Platform-v2.0.0-rc.7-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.7-Pacote-Completo.zip`
- `Tunnara-Platform-v2.0.0-rc.7-Codigo-Fonte.zip`
- `Tunnara-Platform-v2.0.0-rc.7-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.7.patch`
- `Tunnara-Platform-v2.0.0-rc.7.diff`
- `Tunnara-Platform-v2.0.0-rc.7-Arquivos-Alterados.zip`
- `Tunnara-Platform-v2.0.0-rc.7-PR-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.7-Pull-Request.md`
- `Tunnara-Platform-v2.0.0-rc.7-Relatorio-Validacao.md`
- `Tunnara-Platform-v2.0.0-rc.7-SHA256SUMS.txt`

## Correções centrais

1. identidade canônica da draft pelo `release_id`;
2. upload direto pelo endpoint `uploads.github.com`;
3. propagação do ID para Core, Runtime, SDK, Desktop e Mobile;
4. publicação final por ID;
5. teste funcional impedindo regressão para `/releases/tags/{tag}`.

## Política

- releases e tags publicadas permanecem imutáveis;
- cada correção pós-merge recebe nova versão;
- todos os jobs compilam o mesmo SHA e publicam na mesma draft;
- a release somente é publicada após sucesso integral dos grupos obrigatórios.
