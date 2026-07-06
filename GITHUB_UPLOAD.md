# Publicação da correção Tunnara 2.0.0-rc.7 no GitHub

## Branch

```text
fix/v2.0.0-rc7-draft-release-id
```

## Aplicação

```bash
git switch main
git pull --rebase origin main
git switch -c fix/v2.0.0-rc7-draft-release-id
git am /caminho/Tunnara-Platform-v2.0.0-rc.7.patch
git push -u origin fix/v2.0.0-rc7-draft-release-id
```

## Commit

```text
fix(release): use release id for draft asset uploads
```

## Release

O merge deve criar a nova draft `v2.0.0-rc.7`. Não reexecute o workflow da RC.6,
pois ele continuará usando o uploader e o SHA anteriores. Após a RC.7 ser publicada,
a draft incompleta da RC.6 pode ser excluída.
