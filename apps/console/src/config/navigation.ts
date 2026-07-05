import { appFeatures } from "./projectConfig";
export type MenuSection = "dashboard" | "conectividade" | "infraestrutura" | "seguranca" | "sistema" | "documentacao";
export interface MenuItemConfig { title: string; route: string; permission?: string; feature?: keyof typeof appFeatures; section: MenuSection; eyebrow?: string; description?: string; }
export const menuItems: MenuItemConfig[] = [
  { title: "Dashboard", route: "/", permission: "dashboard:view", section: "dashboard" },
  { title: "Túneis", route: "/tuneis", permission: "dashboard:view", section: "conectividade" },
  { title: "Agentes", route: "/agentes", permission: "dashboard:view", section: "conectividade" },
  { title: "Domínios e TLS", route: "/dominios", permission: "config:view", feature: "domains", section: "conectividade" },
  { title: "Redes privadas", route: "/redes", permission: "config:view", feature: "privateNetworks", section: "conectividade" },
  { title: "Nós Edge / Relay", route: "/nos", permission: "config:view", feature: "infrastructureNodes", section: "infraestrutura" },
  { title: "Implantações", route: "/implantacoes", permission: "config:view", feature: "deployments", section: "infraestrutura" },
  { title: "Políticas de acesso", route: "/politicas", permission: "config:view", feature: "accessPolicies", section: "seguranca" },
  { title: "Usuários", route: "/usuarios", permission: "usuarios:view", feature: "legacyAccess", section: "seguranca" },
  { title: "Perfis de usuários", route: "/perfis", permission: "perfis:view", feature: "legacyAccess", section: "seguranca" },
  { title: "Auditoria", route: "/auditoria", permission: "config:view", section: "seguranca" },
  { title: "Logs", route: "/logs", permission: "config:view", feature: "logs", section: "sistema" },
  { title: "Parâmetros", route: "/sistema", permission: "config:view", feature: "systemSettings", section: "sistema" },
  { title: "Banco de dados", route: "/sistema/banco", permission: "config:view", feature: "databaseSettings", section: "sistema" },
  { title: "Diagnósticos", route: "/runtime", permission: "config:view", section: "sistema" },
  { title: "API Interna", route: "/api-interna", permission: "config:view", feature: "internalApi", section: "sistema" },
  { title: "Webhooks", route: "/webhooks", permission: "config:view", feature: "webhookService", section: "sistema" },
  { title: "WebSocket", route: "/websocket", permission: "config:view", feature: "websocketService", section: "sistema" },
  { title: "Integrações", route: "/integracoes", permission: "config:view", feature: "integrations", section: "sistema" },
  { title: "Sobre", route: "/sobre", feature: "about", section: "documentacao" },
  { title: "Guia do usuário", route: "/documentacao/guia", feature: "userGuide", section: "documentacao" },
];
export function isFeatureEnabled(feature?: keyof typeof appFeatures): boolean { return feature ? appFeatures[feature] !== false : true; }
export function visibleMenuItems(): MenuItemConfig[] { return menuItems.filter((item) => isFeatureEnabled(item.feature)); }
export function findMenuItemByRoute(route: string): MenuItemConfig | undefined { const normalize=(v:string)=>((v||'/').replace(/\/+$/,'')||'/'); const target=normalize(route); return visibleMenuItems().find((item)=>normalize(item.route)===target); }
