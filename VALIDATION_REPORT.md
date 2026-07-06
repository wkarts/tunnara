# Tunnara Platform 2.0.0-rc.7 — relatório de validação

## Falha confirmada no run da RC.6

- A draft foi criada com sucesso e recebeu URL `untagged-*`.
- `scripts/release/upload-release-assets.sh` chamou o endpoint
  `repos/wkarts/tunnara/releases/tags/v2.0.0-rc.6`.
- O GitHub retornou HTTP 404 antes do primeiro upload do Core.
- Runtime, SDK, Desktop, Mobile e Containers ficaram `skipped` porque dependiam do Core.

## Correção

- A API de criação retorna o `release_id`, que é preservado em todos os jobs.
- A retomada de drafts usa `GET /releases` e filtra `tag_name`, incluindo drafts.
- O upload usa `POST https://uploads.github.com/.../releases/{release_id}/assets`.
- Assets anteriores são listados e excluídos pelo mesmo ID antes de cada tentativa.
- A publicação final usa `PATCH /releases/{release_id}` com `draft=false`.

## Validações executadas

- versão sincronizada em 26 pontos: `2.0.0-rc.7`;
- build Android/iOS: `200007007`;
- versão MSI: `2.0.0-7007`;
- testes SemVer/MSI: 6/6;
- YAML de todos os workflows;
- sintaxe Bash, Node.js e PHP;
- repository, storage, Docker, mobile, dependências nativas e SEA;
- teste funcional do uploader com `gh` e `curl` simulados;
- teste negativo impedindo uso de `/releases/tags/` para drafts;
- Console Vue: typecheck e build Vite;
- Runtime E2E: HTTP/WebSocket, TCP/UDP, Cloudflare, HA, WireGuard, rede privada, produção e Policy Engine;
- SDK C compartilhado, estático e exemplo de versão.

## Limites do ambiente

Cargo/Rust, Docker Engine, Android SDK completo e Xcode não estavam disponíveis para
reexecutar a matriz nativa completa. A RC.6, porém, não chegou a esses jobs no run
anexado: eles foram ignorados após a falha de upload do Core. A correção atua exatamente
na causa do HTTP 404 e possui teste funcional local do protocolo de upload.
