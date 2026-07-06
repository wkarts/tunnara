# Tunnara Platform 2.0.0-rc.6 — relatório de validação

## Falhas confirmadas no run pós-merge

- Windows/Tauri: `2.0.0-rc.5` foi recusada pelo bundle MSI porque o identificador de prerelease do instalador precisa ser exclusivamente numérico.
- Runtime Linux: o envio falhou com HTTP 422 porque o asset de mesmo nome já existia na draft.
- iOS: `PacketTunnelProvider.swift` ainda chamava `TunnelConfiguration(fromWgQuickConfig:called:)`, initializer não exportado pelo WireGuardKit empacotado.

Os demais jobs do run anexado concluíram: Android, containers, SDK C, Runtime Windows/macOS, Desktop Linux/macOS e core.

## Correções

- `tauri.windows.conf.json` usa a versão derivada `2.0.0-7006`, mantendo a versão pública `2.0.0-rc.6` nos demais pontos.
- O sincronizador atualiza automaticamente a versão MSI nas próximas releases.
- O uploader resolve o ID da release, remove assets existentes por nome/ID e repete a remoção antes de cada retry.
- O Packet Tunnel usa `WgQuickConfigParser.parse(raw, name:)`.
- Os validadores rejeitam o initializer antigo, versão MSI inválida e uploader sem exclusão explícita.

## Validações executadas neste ambiente

- versão sincronizada em 26 pontos;
- testes SemVer, build mobile e versão Windows/MSI: 6/6 aprovados;
- repository, Node, Shell, PHP, storage, Docker, release, mobile e dependências nativas;
- mock funcional do GitHub CLI comprovando exclusão e substituição do asset existente;
- teste negativo comprovando rejeição do initializer iOS antigo;
- Console Vue: typecheck e build Vite aprovados;
- SEA Agent e Server Linux x64 gerados e executados com versão `2.0.0-rc.6`;
- runtime E2E: HTTP/WebSocket, TCP/UDP, Cloudflare, HA, WireGuard, redes privadas, produção e Policy Engine;
- SDK C compartilhado/estático e exemplo de versão.

## Limites do ambiente

A compilação final MSI/WiX e Xcode/iOS deve ser confirmada nos runners nativos do GitHub Actions. A correção está aplicada exatamente nos pontos que os respectivos compiladores rejeitaram.
