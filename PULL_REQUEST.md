# Tunnara Platform 2.0.0-rc.5 — Correção da matriz nativa de release

## Contexto

Após o merge da RC.4, a release coordenada iniciou corretamente, mas falhou em Runtime, Desktop, Android, iOS e na imagem `quic-bridge`.

## Causas confirmadas

- `reqwest 0.13` ainda usava a feature removida `rustls-tls`.
- O Console Tauri recebeu versões incompatíveis de `rand`, `sha2`, `sha1` e `hmac`.
- O AGP 9.2.1 foi executado com Gradle 8.10.2, abaixo do mínimo exigido.
- O WireGuardKit era resolvido remotamente antes da aplicação dos patches locais.
- O bridge Go exigido pelo WireGuardKit não estava integrado ao projeto XcodeGen.

## Alterações

- Corrige o `E0308` do `tunnara-quic-bridge`, uniformizando o retorno dos braços do `match` no loop de aceitação QUIC.
- Remove o import Rust não utilizado observado no Coordinator.
- Corrige o workspace Rust para `reqwest 0.13` com feature `rustls`.
- Fixa as bibliotecas criptográficas do Console nas versões compatíveis com o código atual.
- Atualiza o workflow Android para Gradle 9.4.1.
- Migra o WireGuardKit para um pacote local preparado antes do XcodeGen.
- Atualiza o manifesto Swift Package para tools 5.9 de forma idempotente.
- Integra `WireGuardGoBridgeiOS` e prepara Go no runner macOS.
- Adiciona validação nativa preventiva ao PR.
- Executa `cargo check` do workspace e do Console Tauri no workflow nativo.
- Atualiza as Docker Actions para suas gerações atuais.
- Eleva a versão para `2.0.0-rc.5`, preservando tags e releases anteriores.

## Resultado esperado

- Runtime Linux, Windows, macOS ARM64 e macOS x64 compilam o mesmo SHA.
- Desktop Tauri compila nas quatro plataformas.
- Android gera APK/AAB com Gradle compatível.
- iOS resolve o pacote local já corrigido e compila o bridge WireGuardGo.
- A imagem `quic-bridge` compila o workspace corrigido.
- A release só é publicada após sucesso integral dos grupos obrigatórios.

## Validações

Foram aprovados todos os validadores JavaScript/Shell/PHP, runtime E2E, SDK C, Console TypeScript/Vite, SEA Linux e os novos preflights nativos. Os builds finais dependentes de runners Windows/macOS/Android/Xcode serão confirmados pela nova execução do Actions.

## Squash and merge

```text
fix: publish Tunnara 2.0.0-rc.5 with a compatible native release matrix
```
