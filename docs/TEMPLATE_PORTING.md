# Portabilidade e preservação do template Tauri

## Estratégia aplicada

O template original não foi reduzido a um conjunto de telas copiadas. Ele permanece como uma aplicação completa em `apps/console`, permitindo continuar utilizando seus modos desktop, web, PWA, headless, CLI e serviço.

A adaptação foi feita em camadas:

1. **Visual Core preservado:** CSS, temas, layout, sidebar, topbar, abas, splash, responsividade, diálogos e componentes-base.
2. **Identidade portada:** nomes de aplicação, identificadores, variáveis de ambiente, binários, scripts, PWA, wordmarks e splash foram convertidos para Tunnara.
3. **Domínio adicionado:** foram criados módulos e rotas Tunnara sem reescrever abruptamente as páginas e serviços herdados.
4. **Separação arquitetural:** a interface permanece desacoplada do Control API e dos serviços Rust por contratos HTTP e, futuramente, WebSocket/gRPC.
5. **Compatibilidade futura:** o console pode funcionar como desktop Tauri, painel web servido por Docker ou interface administrativa em CloudPanel.

## Localização dos principais recursos visuais

- Configuração central: `apps/console/src/config/projectConfig.ts`
- Navegação: `apps/console/src/config/navigation.ts`
- Temas: `apps/console/src/styles/`
- Layout: `apps/console/src/layouts/AppLayout.vue`
- Componentes: `apps/console/src/components/`
- Branding: `apps/console/src/assets/branding/`
- Páginas Tunnara: `apps/console/src/pages/tunnara/`
- Metadados Tauri: `apps/console/src-tauri/tauri.conf.json`

## Regra de continuidade

As próximas etapas devem evoluir os providers e serviços, evitando substituir o Visual Core. Mudanças de tema, menu ou layout devem ser feitas por configuração ou novos componentes compatíveis com a estrutura existente.
