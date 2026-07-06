# Tunnara Platform 2.0.0-rc.6 — correção final do pipeline pós-merge

## Causas confirmadas

- O MSI recusava `2.0.0-rc.5`, pois o identificador de prerelease do instalador deve ser exclusivamente numérico.
- O uploader dependia apenas de `--clobber`, mas a API retornava HTTP 422 quando o asset já existia.
- O Packet Tunnel ainda chamava `TunnelConfiguration(fromWgQuickConfig:called:)`, initializer não exportado pelo WireGuardKit usado no build.

## Correções

- Adiciona `tauri.windows.conf.json` com versão derivada `2.0.0-7006`.
- Sincroniza e valida automaticamente a versão MSI em todos os próximos releases.
- Remove explicitamente assets existentes por ID antes de cada upload e nova tentativa.
- Usa `WgQuickConfigParser.parse(raw, name:)` no iOS.
- Reforça validadores de release, versão e mobile.
