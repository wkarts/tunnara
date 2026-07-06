# Publicação da correção Tunnara 2.0.0-rc.5 no GitHub

## Branch

```bash
git switch main
git pull --rebase origin main
git switch -c fix/v2.0.0-rc5-native-release-matrix
```

## Aplicação do patch

```bash
git am /caminho/Tunnara-Platform-v2.0.0-rc.5.patch
git push -u origin fix/v2.0.0-rc5-native-release-matrix
```

## Antes do push

```bash
npm ci --ignore-scripts
npm --prefix apps/console ci --ignore-scripts
npm run version:check
npm run repository:check
npm run validate:native-deps
npm run validate:release
npm run validate:mobile
```

## Após o merge

O merge deve reservar uma nova release `v2.0.0-rc.5`. A release/tag RC.4 permanece imutável.

Não reexecute o workflow antigo da RC.4. Ele sempre utilizará o commit e as dependências antigas.

Caso exista uma draft RC.4 incompleta, mantenha-a não publicada e remova-a somente depois da RC.5 concluir com sucesso.

## Imagens esperadas

```text
ghcr.io/wkarts/tunnara-server:2.0.0-rc.5
ghcr.io/wkarts/tunnara-agent:2.0.0-rc.5
ghcr.io/wkarts/tunnara-console:2.0.0-rc.5
ghcr.io/wkarts/tunnara-control-api:2.0.0-rc.5
ghcr.io/wkarts/tunnara-quic-bridge:2.0.0-rc.5
ghcr.io/wkarts/tunnara-caddy-cloudflare:2.0.0-rc.5
```
