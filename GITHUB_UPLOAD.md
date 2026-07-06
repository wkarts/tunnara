# Publicação da correção Tunnara 2.0.0-rc.6 no GitHub

## Branch

```text
fix/v2.0.0-rc6-release-portability
```

## Aplicação do patch

```bash
git switch main
git pull --rebase origin main
git switch -c fix/v2.0.0-rc6-release-portability
git am /caminho/Tunnara-Platform-v2.0.0-rc.6.patch
git push -u origin fix/v2.0.0-rc6-release-portability
```

## Commit

```text
fix(release): repair MSI versioning, idempotent uploads and iOS parser
```

## Release

O merge deve reservar a nova release `v2.0.0-rc.6`. A draft/tag `v2.0.0-rc.5` não deve ser reutilizada para outro SHA. Após a RC.6 concluir integralmente, a draft RC.5 incompleta pode ser excluída manualmente.

## Imagens esperadas

```text
ghcr.io/wkarts/tunnara-server:2.0.0-rc.6
ghcr.io/wkarts/tunnara-agent:2.0.0-rc.6
ghcr.io/wkarts/tunnara-console:2.0.0-rc.6
ghcr.io/wkarts/tunnara-control-api:2.0.0-rc.6
ghcr.io/wkarts/tunnara-quic-bridge:2.0.0-rc.6
ghcr.io/wkarts/tunnara-caddy-cloudflare:2.0.0-rc.6
```
