# Publicação da correção Tunnara 1.1.3

## Branch recomendada

```bash
git switch main
git pull --rebase origin main
git switch -c fix/immutable-auto-version-release
```

Depois de aplicar as alterações:

```bash
git add --all
git commit -m "fix(release): auto-increment versions and keep published releases immutable"
git push -u origin fix/immutable-auto-version-release
```

Abra o Pull Request para `main`. A versão deste hotfix já está sincronizada em `1.1.3`. No merge, `Version and release after merge` respeita essa versão explícita e dispara a release `v1.1.3`. Nos próximos merges elegíveis, o incremento padrão será `patch`.

## Labels de versão

- `release:patch`: incrementa o PATCH; padrão quando nenhuma label é informada.
- `release:minor`: incrementa o MINOR e zera o PATCH.
- `release:major`: incrementa o MAJOR e zera MINOR/PATCH.
- `release:none`: mescla sem criar nova release.

## Regra de imutabilidade

Uma release já publicada não é reaberta, sobrescrita ou movida para outro commit. Se `vX.Y.Z` já estiver publicada, uma nova alteração deve usar uma versão superior. Somente uma release ainda em draft pode ser retomada e receber assets com `--clobber`.

## Limpeza dos drafts duplicados 1.1.2

Depois que `v1.1.3` for publicada com sucesso, remova os drafts antigos e incompletos de `v1.1.2` pela interface do GitHub. Não publique esses drafts, pois eles foram gerados pela lógica anterior e podem conter apenas parte dos assets.

## Imagens GHCR

A release publica:

```text
ghcr.io/wkarts/tunnara-server:1.1.3
ghcr.io/wkarts/tunnara-agent:1.1.3
ghcr.io/wkarts/tunnara-console:1.1.3
ghcr.io/wkarts/tunnara-control-api:1.1.3
ghcr.io/wkarts/tunnara-quic-bridge:1.1.3
ghcr.io/wkarts/tunnara-caddy-cloudflare:1.1.3
```
