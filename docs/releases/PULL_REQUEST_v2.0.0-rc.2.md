# Pull Request — Tunnara Platform 2.0.0-rc.2

## Branch

```text
fix/v2.0.0-rc2-validation-autoversion
```

## Commit

```text
fix(ci): stabilize validation and add immutable automatic versioning
```

## Título

```text
fix(release): corrigir validações e automatizar versões da Tunnara 2.0 RC
```

## Descrição

### Contexto

Os logs do GitHub Actions revelaram falhas encadeadas no Console, mobile, builds nativos e publicação de releases. A causa estrutural mais grave era a reutilização de uma versão já publicada, gerando drafts duplicadas, assets concorrentes e jobs ignorados.

### Alterações

- Adiciona `esbuild` explicitamente ao Console.
- Implementa SemVer completo e incremento automático de prereleases.
- Considera releases, drafts e tags no cálculo da próxima versão.
- Mantém releases e tags publicadas imutáveis.
- Fixa todos os builds no mesmo SHA e na mesma release draft.
- Passa o `releaseId` existente ao Tauri.
- Usa uploader sequencial/idempotente com retry e `--clobber`.
- Elimina colisões de checksums e metadados entre plataformas.
- Corrige SEA Windows executando os CLIs pelo Node.
- Migra Android para Kotlin integrado do AGP 9 e fixa dependências compatíveis.
- Corrige WireGuardKit/Xcode 16, parser wg-quick, `Info.plist` e build arm64 do iOS.
- Protege tags Docker estáveis contra prereleases.
- Agrupa e limita o Dependabot.
- Mantém PRs sem geração de artefatos de distribuição.

### Validações

- 25 pontos de versão sincronizados.
- 5 testes SemVer/prerelease aprovados.
- Repository, Node, Bash, PHP, storage, Docker, mobile e release validators aprovados.
- Console `vue-tsc` e Vite aprovados.
- Runtime E2E completo aprovado.
- SDK C e executáveis SEA Linux aprovados.
- Workflows e scripts de release verificados.

### Observação

Builds finais que exigem Xcode, Android SDK, Cargo ou Docker são executados pelos runners nativos do GitHub Actions; esta entrega não declara validação física que não ocorreu localmente.

## Squash and merge

```text
fix: publish Tunnara 2.0.0-rc.2 with immutable automatic releases
```
