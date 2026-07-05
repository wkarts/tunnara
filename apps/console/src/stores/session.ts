import { defineStore } from "pinia";
import { logAppError, logAppInfo, logAppWarning } from "../services/logger";
import { storageKey } from "../config/appBranding";
import {
  getControlBaseUrl,
  getControlSession,
  getControlToken,
  setControlBaseUrl,
  setControlToken,
} from "../services/tunnaraApi";

export interface AuthUser {
  id: number;
  nome: string;
  login: string;
  email?: string | null;
  telefone?: string | null;
  cargo?: string | null;
  administrador: boolean;
  master_user: boolean;
  senha_provisoria: boolean;
  permission_keys: string[];
  profile_names: string[];
  company_ids: number[];
  company_names: string[];
  photo_url?: string | null;
}

interface LoginResponse {
  success: boolean;
  message: string;
  session_token?: string | null;
  user?: AuthUser;
}

const STORAGE_KEY = storageKey("session");
const ACTIVE_COMPANY_KEY = storageKey("active-company");

function sessionStore() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function readStorage(): string | null {
  return sessionStore()?.getItem(STORAGE_KEY) ?? null;
}

function writeStorage(value: string | null) {
  const store = sessionStore();
  if (!store) return;
  if (!value) store.removeItem(STORAGE_KEY);
  else store.setItem(STORAGE_KEY, value);
}

function writeActiveCompany(value: number | null) {
  if (typeof window === "undefined") return;
  if (value == null) window.localStorage.removeItem(ACTIVE_COMPANY_KEY);
  else window.localStorage.setItem(ACTIVE_COMPANY_KEY, String(value));
}

function userFromControl(organizationName: string): AuthUser {
  return {
    id: 0,
    nome: organizationName || "Administrador Tunnara",
    login: "control-api",
    email: null,
    telefone: null,
    cargo: "Administrador da organização",
    administrador: true,
    master_user: true,
    senha_provisoria: false,
    permission_keys: ["*"],
    profile_names: ["Control API"],
    company_ids: [],
    company_names: [],
    photo_url: null,
  };
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    user: null as AuthUser | null,
    sessionToken: readStorage() as string | null,
    activeCompanyId: null as number | null,
    loading: false,
    restoring: false,
    initialized: false,
    lastError: "",
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && state.sessionToken && getControlToken()),
    isMaster: (state) => Boolean(state.user?.master_user),
    permissionKeys: (state) => state.user?.permission_keys || [],
    activeCompanyName(state): string {
      return state.user?.nome || "Organização Tunnara";
    },
  },
  actions: {
    clearAuthState({ clearControlToken = true }: { clearControlToken?: boolean } = {}) {
      this.user = null;
      this.sessionToken = null;
      this.activeCompanyId = null;
      this.lastError = "";
      writeStorage(null);
      writeActiveCompany(null);
      if (clearControlToken) setControlToken("");
    },
    can(permission: string) {
      if (!permission) return true;
      if (this.user?.master_user) return true;
      return this.permissionKeys.includes(permission);
    },
    ensureActiveCompany() {
      this.activeCompanyId = null;
      writeActiveCompany(null);
    },
    setActiveCompany(_companyId: number | null) {
      this.activeCompanyId = null;
    },
    async login(controlUrl: string, adminToken: string): Promise<LoginResponse> {
      this.loading = true;
      this.lastError = "";
      try {
        setControlBaseUrl(controlUrl);
        setControlToken(adminToken);
        const control = await getControlSession();
        if (!control.authenticated) throw new Error("A Control API recusou a autenticação.");
        const response: LoginResponse = {
          success: true,
          message: `Conectado à organização ${control.organizationName}.`,
          session_token: `control:${control.tokenId}`,
          user: userFromControl(control.organizationName),
        };
        this.user = response.user!;
        this.sessionToken = response.session_token!;
        writeStorage(this.sessionToken);
        this.initialized = true;
        logAppInfo("auth", "Control API autenticada pelo Console.", { organization: control.organizationName, baseUrl: getControlBaseUrl() });
        return response;
      } catch (error) {
        setControlToken("");
        this.lastError = error instanceof Error ? error.message : "Falha ao autenticar.";
        logAppError("auth", "Erro ao autenticar Control API.", { error: this.lastError, baseUrl: controlUrl });
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async restore() {
      if (this.initialized || this.restoring) return;
      this.restoring = true;
      this.lastError = "";
      try {
        if (!this.sessionToken || !getControlToken()) {
          this.clearAuthState({ clearControlToken: false });
          return;
        }
        const control = await getControlSession();
        this.user = userFromControl(control.organizationName);
        this.sessionToken = `control:${control.tokenId}`;
        writeStorage(this.sessionToken);
        logAppInfo("session", "Sessão da Control API restaurada.", { organization: control.organizationName });
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : "Falha ao restaurar sessão.";
        this.clearAuthState();
        logAppWarning("session", "Sessão da Control API inválida ou expirada.", { error: this.lastError });
      } finally {
        this.initialized = true;
        this.restoring = false;
      }
    },
    async validateCurrentSession() {
      if (!this.sessionToken || !getControlToken()) return false;
      try {
        const control = await getControlSession();
        this.user = userFromControl(control.organizationName);
        return true;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : "Sessão inválida.";
        this.clearAuthState();
        return false;
      }
    },
    async logout({ silent = false }: { silent?: boolean } = {}) {
      const organization = this.user?.nome ?? null;
      this.clearAuthState();
      this.initialized = true;
      if (!silent) logAppInfo("session", "Sessão do Console encerrada.", { organization });
    },
  },
});
