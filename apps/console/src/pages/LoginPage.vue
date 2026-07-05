<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "../stores/session";
import { getControlBaseUrl } from "../services/tunnaraApi";
import logoDark from "../assets/branding/logo-dark.png";
import { appBranding } from "../config/appBranding";
import { logAppError, logAppInfo } from "../services/logger";

const router = useRouter();
const session = useSessionStore();
const form = reactive({ controlUrl: "", adminToken: "" });
const error = ref("");
const info = ref("");
const logoFailed = ref(false);

function handleLogoError() {
  logoFailed.value = true;
  logAppError("assets", "Falha ao carregar logo-dark.png; fallback visual aplicado.", { asset: "src/assets/branding/logo-dark.png" });
}

function clearCredentials() {
  form.adminToken = "";
  error.value = "";
  info.value = "";
}

onMounted(() => {
  form.controlUrl = getControlBaseUrl();
  clearCredentials();
});

async function submit() {
  error.value = "";
  info.value = "";
  try {
    const response = await session.login(form.controlUrl, form.adminToken);
    info.value = response.message;
    logAppInfo("auth", "Login da Control API concluído.", { controlUrl: form.controlUrl });
    form.adminToken = "";
    await router.push("/");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Falha ao autenticar.";
    logAppError("auth", "Falha de autenticação exibida na tela de login.", { controlUrl: form.controlUrl, error: error.value });
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <div class="login-brand">
        <img v-if="!logoFailed" :src="logoDark" :alt="appBranding.appName" class="login-logo" @error="handleLogoError" />
        <div v-else class="login-logo fallback-logo">{{ appBranding.shortName }}</div>
      </div>
      <div class="badge">{{ appBranding.appName }}</div>
      <h1>Acesso ao Control Plane</h1>
      <p class="muted">Informe a URL da Control API e o token administrativo da sua organização.</p>

      <form class="grid" @submit.prevent="submit">
        <div class="field">
          <label>URL da Control API</label>
          <input v-model="form.controlUrl" type="url" autocomplete="url" placeholder="https://control.exemplo.com.br" required />
        </div>
        <div class="field">
          <label>Token administrativo</label>
          <input v-model="form.adminToken" type="password" autocomplete="off" placeholder="tnr_admin_..." required />
        </div>
        <div v-if="info" class="alert info">{{ info }}</div>
        <div v-if="error" class="alert error">{{ error }}</div>
        <button class="primary" type="submit" :disabled="session.loading || session.restoring">
          {{ session.loading ? "Validando..." : session.restoring ? "Restaurando..." : "Conectar" }}
        </button>
        <div class="actions top-gap-12">
          <button class="secondary" type="button" @click="clearCredentials">Limpar token</button>
        </div>
      </form>
    </div>
  </div>
</template>
