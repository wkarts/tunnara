import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import AppLayout from "../layouts/AppLayout.vue";
import LoginPage from "../pages/LoginPage.vue";

const DashboardPage = () => import("../pages/DashboardPage.vue");
const EntityPage = () => import("../pages/EntityPage.vue");
const EmpresaPage = () => import("../pages/EmpresaPage.vue");
const UsuarioPage = () => import("../pages/UsuarioPage.vue");
const PerfilPage = () => import("../pages/PerfilPage.vue");
const SystemPage = () => import("../pages/SystemPage.vue");
const LicensingPage = () => import("../pages/LicensingPage.vue");
const AboutPage = () => import("../pages/AboutPage.vue");
const AppLogsPage = () => import("../pages/AppLogsPage.vue");
const UserGuidePage = () => import("../pages/UserGuidePage.vue");
const TechnicalSheetPage = () => import("../pages/optional/TechnicalSheetPage.vue");
const SyncPage = () => import("../pages/optional/SyncPage.vue");
const InternalApiPage = () => import("../pages/optional/InternalApiPage.vue");
const ScalarDocsPage = () => import("../pages/optional/ScalarDocsPage.vue");
const WebhookServicePage = () => import("../pages/optional/WebhookServicePage.vue");
const WebSocketServicePage = () => import("../pages/optional/WebSocketServicePage.vue");
const DatabasePage = () => import("../pages/optional/DatabasePage.vue");
const IntegrationPage = () => import("../pages/optional/IntegrationPage.vue");
const PrintPreviewPage = () => import("../pages/PrintPreviewPage.vue");
const RuntimeDiagnosticsPage = () => import("../pages/RuntimeDiagnosticsPage.vue");
const TunnelsPage = () => import("../pages/tunnara/TunnelsPage.vue");
const AgentsPage = () => import("../pages/tunnara/AgentsPage.vue");
const NodesPage = () => import("../pages/tunnara/NodesPage.vue");
const DomainsPage = () => import("../pages/tunnara/DomainsPage.vue");
const NetworksPage = () => import("../pages/tunnara/NetworksPage.vue");
const PoliciesPage = () => import("../pages/tunnara/PoliciesPage.vue");
const RequestInspectorPage = () => import("../pages/tunnara/RequestInspectorPage.vue");
const DeploymentsPage = () => import("../pages/tunnara/DeploymentsPage.vue");
const AuditPage = () => import("../pages/tunnara/AuditPage.vue");

import { entityConfigs } from "../config/entities";
import { appFeatures } from "../config/projectConfig";
import { isFeatureEnabled } from "../config/navigation";
import { useSessionStore } from "../stores/session";
import { logAppError, logAppInfo, logAppWarning } from "../services/logger";

const permissionByEntity: Record<string, string> = {
  departamentos: "cadastros:view",
  funcoes: "cadastros:view",
  centro_custos: "cadastros:view",
  clientes: "cadastros:view",
  fornecedores: "cadastros:view",
  produtos: "cadastros:view"
};

const genericEntityRoutes: RouteRecordRaw[] = Object.values(entityConfigs).map((entity) => ({
  path: entity.route.replace(/^\//, ""),
  component: EntityPage,
  props: { entityKey: entity.key },
  meta: { permission: permissionByEntity[entity.key] ?? "cadastros:view", feature: "genericEntities" }
}));

const routes: RouteRecordRaw[] = [
  { path: "/login", component: LoginPage },
  { path: "/print-preview", component: PrintPreviewPage },
  {
    path: "/",
    component: AppLayout,
    children: [
      { path: "", component: DashboardPage, meta: { permission: "dashboard:view" } },
      { path: "tuneis", component: TunnelsPage, meta: { permission: "dashboard:view" } },
      { path: "agentes", component: AgentsPage, meta: { permission: "dashboard:view" } },
      { path: "nos", component: NodesPage, meta: { permission: "config:view", feature: "infrastructureNodes" } },
      { path: "dominios", component: DomainsPage, meta: { permission: "config:view", feature: "domains" } },
      { path: "redes", component: NetworksPage, meta: { permission: "config:view", feature: "privateNetworks" } },
      { path: "politicas", component: PoliciesPage, meta: { permission: "config:view", feature: "accessPolicies" } },
      { path: "inspector", component: RequestInspectorPage, meta: { permission: "config:view", feature: "requestInspector" } },
      { path: "implantacoes", component: DeploymentsPage, meta: { permission: "config:view", feature: "deployments" } },
      { path: "auditoria", component: AuditPage, meta: { permission: "config:view" } },
      { path: "empresas", component: EmpresaPage, meta: { permission: "empresas:view" } },
      { path: "usuarios", component: UsuarioPage, meta: { permission: "usuarios:view", feature: "legacyAccess" } },
      { path: "perfis", component: PerfilPage, meta: { permission: "perfis:view", feature: "legacyAccess" } },
      ...genericEntityRoutes,
      { path: "sistema", component: SystemPage, meta: { permission: "config:view", feature: "systemSettings" } },
      { path: "sistema/banco", component: DatabasePage, meta: { permission: "config:view", feature: "databaseSettings" } },
      { path: "licenciamento", component: LicensingPage, meta: { permission: "config:view", feature: "licensing" } },
      { path: "sobre", component: AboutPage, meta: { feature: "about" } },
      { path: "logs", component: AppLogsPage, meta: { permission: "config:view", feature: "logs" } },
      { path: "runtime", component: RuntimeDiagnosticsPage, meta: { permission: "config:view" } },
      { path: "documentacao/guia", component: UserGuidePage, meta: { feature: "userGuide" } },
      { path: "ficha-tecnica", component: TechnicalSheetPage, meta: { permission: "config:view", feature: "technicalSheet" } },
      { path: "sincronizacao", component: SyncPage, meta: { permission: "config:view", feature: "sync" } },
      { path: "api-interna", component: InternalApiPage, meta: { permission: "config:view", feature: "internalApi" } },
      { path: "documentacao/scalar", component: ScalarDocsPage, meta: { permission: "config:view", feature: "scalarDocs" } },
      { path: "webhooks", component: WebhookServicePage, meta: { permission: "config:view", feature: "webhookService" } },
      { path: "websocket", component: WebSocketServicePage, meta: { permission: "config:view", feature: "websocketService" } },
      { path: "integracoes", component: IntegrationPage, meta: { permission: "config:view", feature: "integrations" } },
    ]
  }
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach(async (to) => {
  const session = useSessionStore();
  if (!session.initialized) {
    try {
      await session.restore();
    } catch (error) {
      logAppError("router", "Falha ao restaurar sessão durante navegação.", {
        to: to.fullPath,
        error: error instanceof Error ? error.message : String(error),
      });
      session.clearAuthState();
    }
  }

  if (to.path !== "/login" && !session.isAuthenticated) {
    logAppWarning("router", "Navegação bloqueada por ausência de autenticação.", { to: to.fullPath });
    return "/login";
  }
  if (to.path === "/login" && session.isAuthenticated) return "/";

  const requiredFeature = to.meta?.feature as keyof typeof appFeatures | undefined;
  if (!isFeatureEnabled(requiredFeature)) {
    logAppWarning("router", "Rota bloqueada porque o módulo está desativado.", { to: to.fullPath, feature: requiredFeature });
    return "/";
  }

  const requiredPermission = to.meta?.permission as string | undefined;
  if (requiredPermission && !session.can(requiredPermission)) {
    logAppWarning("router", "Navegação bloqueada por permissão insuficiente.", {
      to: to.fullPath,
      permission: requiredPermission,
      user: session.user?.login,
    });
    return "/";
  }

  return true;
});

router.afterEach((to) => {
  const session = useSessionStore();
  logAppInfo("navigation", "Rota carregada.", {
    to: to.fullPath,
    authenticated: session.isAuthenticated,
    user: session.user?.login ?? null,
  });
});

router.onError((error) => {
  logAppError("router", "Erro interno de roteamento.", {
    error: error instanceof Error ? error.message : String(error),
  });
});

export default router;
