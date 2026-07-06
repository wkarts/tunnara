# Tunnara Platform 2.0.0-rc.7 — release draft coordenada por ID

## Causa confirmada

O job `prepare` criou a draft `v2.0.0-rc.6`, mas a URL retornada pelo GitHub era
`releases/tag/untagged-*`. O uploader tentou resolver essa draft por
`repos/{repo}/releases/tags/v2.0.0-rc.6` e recebeu HTTP 404.

A falha ocorreu no Core; os demais grupos foram `skipped` por dependência, e não por
falhas próprias de compilação.

## Alterações

- release draft criada/retomada pela API REST;
- `release_id` numérico usado como identidade canônica da execução;
- upload direto para `uploads.github.com` por release ID;
- Runtime, SDK, Desktop e Mobile recebem o mesmo ID;
- publicação final por ID;
- fallback manual resolve drafts pela listagem geral de releases;
- teste funcional bloqueia regressão para o endpoint `/releases/tags/{tag}`.

## Branch

`fix/v2.0.0-rc7-draft-release-id`

## Commit

`fix(release): use release id for draft asset uploads`

## Título

`fix(release): corrigir HTTP 404 e coordenar drafts por release ID na RC.7`

## Squash/Merge

`fix: publish Tunnara 2.0.0-rc.7 with release-id coordinated drafts`
