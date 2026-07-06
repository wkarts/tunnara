# Relatório de validação — Tunnara Platform 2.0.0-rc.2

Data: 2026-07-06

## Falhas reproduzidas dos logs

- Console Vue: `Cannot find package 'esbuild'` durante o Vite 8.1.3.
- Mobile: versão SemVer prerelease comparada diretamente ao campo numérico do iOS.
- Android: configurações legadas de Kotlin incompatíveis com AGP 9 e dependências acima do `compileSdk` adotado.
- iOS: incompatibilidades do WireGuardKit/Xcode, parser wg-quick, `Info.plist` ausente e diferenças entre GNU/Linux e macOS.
- Runtime Windows: execução de wrappers `.cmd` do `esbuild`/`postject` pelo `spawnSync`.
- Release: colisões entre assets concorrentes, drafts paralelas e jobs ignorados pela reutilização de uma versão publicada.
- Versionamento: cálculo anterior ignorava prereleases ou tags sem release e permitia tentativa de reutilização de tag.

## Correções aplicadas

- `esbuild` explícito no Console e lockfile público sincronizado.
- SemVer completo com incremento automático `rc.N`, promoção estável e bumps patch/minor/major.
- Cálculo da próxima versão considera releases, drafts e tags existentes.
- Build mobile monotônico: `200007002` para `2.0.0-rc.2`.
- iOS usa versão base `2.0.0`, gera `Info.plist`, compila simulador arm64 e prepara WireGuardKit de forma idempotente.
- Android usa Kotlin integrado do AGP 9.2.1 e dependências compatíveis com API 35.
- Executáveis SEA usam os CLIs JavaScript via Node, inclusive no Windows.
- Uploader sequencial e idempotente com nomes exclusivos de checksums/metadados.
- Uma única release draft recebe Core, Runtime, SDK, Desktop e Mobile pelo mesmo SHA e `releaseId`.
- Releases publicadas e tags são imutáveis; apenas drafts do mesmo SHA podem ser retomadas.
- Containers prerelease não sobrescrevem `latest`.
- PRs e validações comuns não criam artefatos de distribuição.

## Validações executadas localmente

- `npm ci` da raiz e do Console: aprovado.
- `npm run repository:check`: aprovado.
- `npm run version:check`: 25 pontos sincronizados.
- `npm run version:test`: 5 testes aprovados.
- `npm run validate:mobile`: aprovado sem gerar APK/IPA.
- `npm run validate:release`: aprovado.
- Sintaxe Node.js, Bash e PHP: aprovada.
- Providers SQLite, Memory, PostgreSQL, MySQL e Redis: validados.
- Modelos Docker e versionamento de imagens: validados.
- Console Vue/TypeScript e build Vite: aprovados.
- Runtime E2E HTTP, WebSocket, TCP, UDP, Cloudflare, HA, WireGuard, rede privada, produção e Policy Engine: aprovados.
- SDK C compartilhado/estático e smoke test: aprovados.
- Agent e Server SEA Linux x64 gerados e executados: aprovados.
- Workflows YAML analisados e scripts de release verificados.

## Limitações do ambiente de validação

Docker Engine, Cargo/Rust toolchain, Composer e Xcode não estavam instalados neste ambiente. Por isso, a compilação final do QUIC Bridge, Tauri, Android, iOS e containers permanece destinada aos runners nativos do GitHub Actions. Não é correto afirmar que esses binários nativos foram executados localmente; o que foi concluído aqui é a correção de código, configuração, sintaxe, contratos de workflow e validações disponíveis.
