# Publicação da correção Tunnara 1.1.2

## Branch recomendada

```bash
git switch main
git pull --rebase origin main
git switch -c fix/post-merge-release-dependency-compatibility
```

Copie as alterações, revise e publique:

```bash
git add --all
git commit -m "fix(release): repair Rust, Android and iOS builds after dependency updates"
git push -u origin fix/post-merge-release-dependency-compatibility
```

Abra o Pull Request para `main`. O arquivo `VERSION` está em `1.1.2`; após o merge, o workflow `Release after merge` cria `v1.1.2` como draft, executa Runtime, SDK, Desktop, Mobile e Containers e só publica a release depois do sucesso completo.

## Pull Requests do Dependabot existentes

Feche os PRs major incompatíveis de Pinia 3, Vue Router 5, TypeScript 6 e dos crates Rust do Console que foram bloqueados pela nova política. Os PRs de GitHub Actions já incorporados nesta correção ficam redundantes e também podem ser fechados após o merge.

Atualizações minor/patch futuras serão agrupadas e limitadas pelo `.github/dependabot.yml`; atualizações major exigem uma migração dedicada com CI completo.

## Rebuild manual

Em `Actions → Release after merge → Run workflow`, use `force_rebuild: true` apenas para reconstruir a mesma versão depois de corrigir uma release draft.

## Imagens GHCR

A release publica:

```text
ghcr.io/wkarts/tunnara-server:1.1.2
ghcr.io/wkarts/tunnara-agent:1.1.2
ghcr.io/wkarts/tunnara-console:1.1.2
ghcr.io/wkarts/tunnara-control-api:1.1.2
ghcr.io/wkarts/tunnara-quic-bridge:1.1.2
ghcr.io/wkarts/tunnara-caddy-cloudflare:1.1.2
```

## Mobile sem publicação nas lojas

Os jobs Android e iOS geram os artefatos compatíveis com as credenciais disponíveis. Publicação no Google Play e TestFlight permanece desabilitada por padrão.
