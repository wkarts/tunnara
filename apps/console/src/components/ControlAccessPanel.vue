<script setup lang="ts">
import { ref } from "vue";
import BaseSectionCard from "./base/BaseSectionCard.vue";
import {
  getControlBaseUrl,
  getControlToken,
  setControlBaseUrl,
  setControlToken,
  getControlSession,
} from "../services/tunnaraApi";

const emit = defineEmits<{ saved: [] }>();
const baseUrl = ref(getControlBaseUrl());
const token = ref(getControlToken());
const status = ref("");
const error = ref("");
const testing = ref(false);

function save() {
  setControlBaseUrl(baseUrl.value);
  setControlToken(token.value);
  status.value = "Configuração salva neste dispositivo.";
  error.value = "";
  emit("saved");
}

async function test() {
  testing.value = true;
  status.value = "";
  error.value = "";
  save();
  try {
    const response = await getControlSession();
    status.value = `Autenticado em ${response.organizationName}.`;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Falha ao conectar.";
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <BaseSectionCard title="Conexão com o Control API" subtitle="O token permanece somente na sessão atual do navegador.">
    <div class="grid two-cols">
      <div class="field">
        <label>URL do Control API</label>
        <input v-model="baseUrl" type="text" placeholder="/control ou http://servidor:7100" />
      </div>
      <div class="field">
        <label>Token administrativo</label>
        <input v-model="token" type="password" autocomplete="off" placeholder="tnr_admin_..." />
      </div>
    </div>
    <div class="actions top-gap-12">
      <button class="secondary" type="button" @click="save">Salvar</button>
      <button class="primary" type="button" :disabled="testing" @click="test">
        {{ testing ? "Testando..." : "Testar conexão" }}
      </button>
    </div>
    <div v-if="status" class="alert info top-gap-12">{{ status }}</div>
    <div v-if="error" class="alert error top-gap-12">{{ error }}</div>
  </BaseSectionCard>
</template>
