# Tunnara Platform 2.0.0-rc.7 — corrigir HTTP 404 em release draft

## Contexto

A RC.6 criou corretamente a GitHub Release draft, mas o job `core` falhou ao tentar
consultá-la por `GET /releases/tags/v2.0.0-rc.6`. Enquanto a release permanece em
draft, o GitHub a expõe por uma URL `untagged-*`, e o endpoint de tag pode retornar
HTTP 404.

Como Runtime, SDK, Desktop, Mobile e Containers dependem do job `core`, todos foram
ignorados após essa falha inicial.

## Correção

- Cria e retoma drafts pela API REST de releases, capturando o `release_id` da resposta.
- Propaga o mesmo `release_id` para todos os reusable workflows que publicam assets.
- Resolve drafts pela listagem geral de releases, incluindo drafts, apenas quando o ID
  não foi informado em execução manual.
- Faz upload binário diretamente pelo endpoint `uploads.github.com` com o ID da release.
- Publica a release final por ID.
- Adiciona teste funcional do uploader e validações estáticas contra `/releases/tags/`.

## Resultado esperado

O Core anexa os artefatos à draft criada pelo job `prepare`; em seguida Runtime, SDK,
Desktop, Mobile e Containers executam normalmente sobre o mesmo SHA e a mesma release.
