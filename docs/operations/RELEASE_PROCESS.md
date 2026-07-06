# Processo de release

## Regra de versão

- correção compatível: patch;
- nova funcionalidade compatível: minor;
- alteração incompatível: major.

## Preparação

```bash
npm ci
npm --prefix apps/console ci
npm run validate
npm run version:set -- 2.0.0-rc.5
npm run version:check
```

Atualize `CHANGELOG.md` e abra um Pull Request.

## Após o merge

O workflow `Release after merge` usa a versão exata do arquivo `VERSION` e cria uma release draft.

Assets obrigatórios:

- código-fonte e pacote GitHub-ready;
- pacote Docker;
- Console Web;
- Runtime Linux/Windows/macOS;
- SDK C Linux/Windows/macOS;
- Desktop Tauri;
- APK/AAB e IPA/simulador;
- imagens GHCR multi-arquitetura;
- checksums e manifesto.

A release permanece draft em caso de falha.
