# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.8

## Pacotes

- `Tunnara-Platform-v2.0.0-rc.8-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.8-Pacote-Completo.zip`
- `Tunnara-Platform-v2.0.0-rc.8-Codigo-Fonte.zip`
- `Tunnara-Platform-v2.0.0-rc.8-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.8.patch`
- `Tunnara-Platform-v2.0.0-rc.8.diff`
- `Tunnara-Platform-v2.0.0-rc.8-Arquivos-Alterados.zip`
- `Tunnara-Platform-v2.0.0-rc.8-PR-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.8-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.8-Pull-Request.md`
- `Tunnara-Platform-v2.0.0-rc.8-Relatorio-Validacao.md`
- `Tunnara-Platform-v2.0.0-rc.8-SHA256SUMS.txt`

## Correções centrais

1. upload idempotente diante de assets completos já existentes;
2. recuperação de corrida HTTP 422 com polling do upload concorrente;
3. remoção segura de assets `starter` ou vazios;
4. alvo de simulador iOS isolado do runtime Go e da Packet Tunnel Extension;
5. alvo device/IPA preservado com WireGuardKit completo;
6. validações preventivas e testes funcionais de regressão.

## Política

- releases e tags publicadas permanecem imutáveis;
- cada correção pós-merge recebe nova versão;
- todos os jobs compilam o mesmo SHA e publicam na mesma draft;
- assets completos da mesma draft são tratados como resultado idempotente;
- a release somente é publicada após sucesso integral dos grupos obrigatórios.
