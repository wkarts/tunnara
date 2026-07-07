# Publicação da correção Tunnara 2.0.0-rc.8 no GitHub

## Branch

```text
fix/v2.0.0-rc8-ios-runtime-idempotency
```

## Aplicação

```bash
git switch main
git pull --rebase origin main

git switch -c fix/v2.0.0-rc8-ios-runtime-idempotency
git am /caminho/Tunnara-Platform-v2.0.0-rc.8.patch
git push -u origin fix/v2.0.0-rc8-ios-runtime-idempotency
```

## Commit

```text
fix(release): stabilize runtime uploads and isolate iOS simulator build
```

## Após o merge

Aguarde a nova execução criar a draft `v2.0.0-rc.8`. Não use **Re-run jobs**
no workflow da RC.7, pois ele continuará executando o SHA anterior.

O uploader aceita assets completos já anexados à mesma draft. Para substituir
intencionalmente um asset completo durante uma manutenção manual, defina:

```bash
TUNNARA_RELEASE_ASSET_REPLACE=1
```
