<script setup lang="ts">
import { onMounted, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { createProvisioningToken, listAgents, revokeAgent, type TunnaraAgent } from "../../services/tunnaraApi";

const columns = [
  { key: "name", label: "Agente" },
  { key: "platformLabel", label: "Plataforma" },
  { key: "version", label: "Versão" },
  { key: "lastSeenLabel", label: "Último contato" },
  { key: "status", label: "Status" },
];
const rows = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const error = ref("");
const tokenName = ref("Novo agente");
const tokenTtl = ref(900);
const generatedToken = ref("");
const generatedExpiresAt = ref("");

function mapAgent(agent: TunnaraAgent): Record<string, unknown> {
  return {
    ...agent,
    platformLabel: `${agent.platform} ${agent.architecture}`,
    lastSeenLabel: agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString("pt-BR") : "Nunca",
  };
}

async function load() {
  loading.value = true;
  error.value = "";
  try { rows.value = (await listAgents()).map(mapAgent); }
  catch (err) { error.value = err instanceof Error ? err.message : "Falha ao carregar agentes."; }
  finally { loading.value = false; }
}

async function generateToken() {
  loading.value = true;
  error.value = "";
  generatedToken.value = "";
  try {
    const result = await createProvisioningToken(tokenName.value || "Novo agente", Number(tokenTtl.value) || 900);
    generatedToken.value = result.token;
    generatedExpiresAt.value = new Date(result.expiresAt).toLocaleString("pt-BR");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Falha ao gerar token.";
  } finally {
    loading.value = false;
  }
}

async function revoke(row: Record<string, unknown>) {
  if (!window.confirm(`Revogar o agente ${String(row.name || row.id)}?`)) return;
  try { await revokeAgent(String(row.id)); await load(); }
  catch (err) { error.value = err instanceof Error ? err.message : "Falha ao revogar agente."; }
}

async function copyToken() {
  if (generatedToken.value) await navigator.clipboard.writeText(generatedToken.value);
}

onMounted(load);
</script>

<template>
  <BasePage title="Agentes" subtitle="Dispositivos, servidores e aplicações conectadas ao plano de controle." eyebrow="Tunnara Platform" icon="server">
    <template #actions>
      <button class="primary" type="button" :disabled="loading" @click="load">{{ loading ? "Atualizando..." : "Atualizar" }}</button>
    </template>

    <ControlAccessPanel @saved="load" />

    <div v-if="error" class="alert error">{{ error }}</div>

    <BaseSectionCard title="Provisionar novo agente" subtitle="O token é de uso único e expira automaticamente.">
      <div class="grid two-cols">
        <div class="field"><label>Identificação</label><input v-model="tokenName" type="text" /></div>
        <div class="field"><label>Validade em segundos</label><input v-model.number="tokenTtl" type="number" min="60" max="86400" /></div>
      </div>
      <div class="actions top-gap-12">
        <button class="primary" type="button" :disabled="loading" @click="generateToken">Gerar token</button>
      </div>
      <div v-if="generatedToken" class="alert info top-gap-12">
        <strong>Token:</strong> <code>{{ generatedToken }}</code><br />
        <strong>Expira:</strong> {{ generatedExpiresAt }}
        <div class="actions top-gap-12"><button class="secondary" type="button" @click="copyToken">Copiar token</button></div>
      </div>
    </BaseSectionCard>

    <BaseSectionCard title="Agentes registrados" subtitle="Estado reportado pelas sessões conectadas ao Relay.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhum agente registrado.">
        <template #actions="{ row }">
          <button class="secondary compact-button" type="button" :disabled="row.status === 'revoked'" @click="revoke(row)">Revogar</button>
        </template>
      </BaseDataGrid>
    </BaseSectionCard>
  </BasePage>
</template>
