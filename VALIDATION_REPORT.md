# Relatório de validação — Tunnara Platform 2.0.0-rc.3

Data: 2026-07-06

## Falha reproduzida do build pós-merge

O job `Build and upload core assets` falhou depois de concluir o Console e o SDK C. O comando efetivo foi equivalente a:

```text
node node_modules/esbuild/bin/esbuild ...
```

No runner Linux, `node_modules/esbuild/bin/esbuild` é um executável ELF. O Node.js tentou interpretar o cabeçalho binário como JavaScript e encerrou com:

```text
SyntaxError: Invalid or unexpected token
```

O job `Publish completed release` apenas propagou a falha do Core e manteve a release em draft.

## Correções aplicadas

- `scripts/release/build-sea.mjs` usa `build()` importado do pacote `esbuild`.
- O bundle do Agent e do Server é gerado diretamente pela API JavaScript, sem wrappers `.cmd` e sem interpretar executáveis nativos como scripts.
- O CLI JavaScript do `postject` permanece executado por `process.execPath`.
- Falhas de inicialização de subprocessos agora preservam a mensagem original.
- Adicionado `scripts/ci/validate-sea-builder.mjs` com bundle real em memória para Agent e Server.
- Adicionado `npm run validate:sea` ao CI rápido e à validação completa.
- O validador da release rejeita o padrão incorreto `node <binário-esbuild>`.
- Versão elevada para `2.0.0-rc.3`; build mobile `200007003`.

## Validações executadas

- `npm ci` da raiz e do Console: aprovado.
- `npm run repository:check`: aprovado.
- `npm run version:check`: 25 pontos sincronizados.
- `npm run version:test`: 5 testes aprovados.
- `npm run validate:node`, `validate:shell` e `validate:php`: aprovados.
- `npm run validate:storage`: SQLite, Memory, PostgreSQL, MySQL e Redis aprovados.
- `npm run validate:release`: aprovado.
- `npm run validate:sea`: Agent e Server compilados em memória sem artefatos persistentes.
- `npm run validate:docker` e `validate:mobile`: aprovados.
- Runtime E2E HTTP, WebSocket, TCP, UDP, Cloudflare, HA, WireGuard, rede privada, produção e Policy Engine: aprovados.
- SDK C compartilhado/estático e smoke test: aprovados.
- Console Vue/TypeScript e build Vite: aprovados.
- Agent e Server SEA Linux x64 gerados e executados; ambos reportaram `2.0.0-rc.3`.
- Empacotamento dos artefatos e checksums: aprovado.

## Limitações do ambiente

A confirmação final dos builds Windows, macOS, Tauri, Android, iOS e imagens multi-arquitetura continua sendo executada nos runners nativos do GitHub Actions. A correção central é portável porque utiliza a API do pacote `esbuild`, e não um caminho de executável específico do sistema.
