# GitHub Actions

## Pull Requests

Executam somente validações rápidas e não geram artifacts de distribuição:

- integridade e versão;
- testes do runtime;
- typecheck/build do Console;
- Rust fmt/check quando necessário;
- validação Laravel quando necessário;
- validação mobile de configuração.

## Release

Uma release automática acontece somente quando `VERSION` muda em `main`.

O fluxo:

1. cria ou reabre a GitHub Release como draft;
2. compila e envia os assets centrais;
3. chama workflows reutilizáveis de Runtime, SDK, Desktop, Mobile e Containers;
4. aguarda todos os workflows;
5. mantém a release em draft se algum build falhar;
6. publica a release somente quando todos os builds obrigatórios terminam.

Nenhum job usa `actions/upload-artifact`.

## Runners macOS

- Apple Silicon: `macos-15`.
- Intel x64: `macos-15-intel`.
- `macos-13` não é utilizado.

## Nova versão

```bash
npm run version:set -- 1.1.1
npm run version:check
```

O PR deve conter a mudança do `VERSION`. Após o merge, o workflow cria `v1.1.1`.

## Rebuild

Execute manualmente `Release after merge` com `force_rebuild=true`.
