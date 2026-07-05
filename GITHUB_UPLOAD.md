# Publicação da Tunnara 1.1.0 no GitHub

## Branch da versão

```bash
git switch main
git pull --rebase origin main
git switch -c release/v1.1.0-docker-release-hardening
```

Copie as alterações, revise e publique:

```bash
git add --all
git commit -m "feat: release Tunnara 1.1.0 with production Docker and coordinated builds"
git push -u origin release/v1.1.0-docker-release-hardening
```

Abra o Pull Request para `main`. O arquivo `VERSION` está em `1.1.0`; após o merge, o workflow `Release after merge` cria `v1.1.0` como draft, executa todos os reusable workflows e publica a release somente depois do sucesso completo.

## Rebuild manual

Em `Actions → Release after merge → Run workflow`:

```text
force_rebuild: true
```

Use essa opção para substituir assets de uma release draft ou reconstruir uma versão já existente.

## Imagens GHCR

A release publica:

```text
ghcr.io/wkarts/tunnara-server:1.1.0
ghcr.io/wkarts/tunnara-agent:1.1.0
ghcr.io/wkarts/tunnara-console:1.1.0
ghcr.io/wkarts/tunnara-control-api:1.1.0
ghcr.io/wkarts/tunnara-quic-bridge:1.1.0
ghcr.io/wkarts/tunnara-caddy-cloudflare:1.1.0
```

## Mobile sem publicação nas lojas

Os jobs Android e iOS sempre geram os artefatos compatíveis com as credenciais disponíveis. Publicação no Google Play e TestFlight permanece desabilitada por padrão.

## Secrets opcionais

Consulte `docs/operations/GITHUB_ACTIONS.md` e `docs/operations/RELEASE_PROCESS.md` para assinatura Tauri, Android, iOS e publicação em lojas.
