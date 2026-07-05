<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { createTunnel, deleteTunnel, listAgents, listTunnels, type TunnaraAgent, type TunnaraTunnel } from "../../services/tunnaraApi";

const columns = [
  { key: "name", label: "Nome" }, { key: "protocol", label: "Protocolo" },
  { key: "endpoint", label: "Endpoint público" }, { key: "target", label: "Destino" },
  { key: "transport", label: "Transporte" }, { key: "status", label: "Status" },
];
const rows = ref<Record<string, unknown>[]>([]);
const agents = ref<TunnaraAgent[]>([]);
const loading = ref(false); const error = ref(""); const info = ref("");
const form = reactive({ agentId: "", name: "Aplicação HTTP", protocol: "http" as "http"|"https"|"tcp"|"udp", hostname: "", publicPort: 0, targetPort: 8080, autoDns: true, transport: "auto" as "auto"|"tcp"|"quic" });
const isWeb = computed(() => form.protocol === "http" || form.protocol === "https");

function mapTunnel(tunnel: TunnaraTunnel): Record<string, unknown> { return { ...tunnel, protocol: tunnel.protocol.toUpperCase() }; }
async function load() {
  loading.value = true; error.value = "";
  try {
    const [tunnelRows, agentRows] = await Promise.all([listTunnels(), listAgents()]);
    rows.value = tunnelRows.map(mapTunnel); agents.value = agentRows;
    if (!form.agentId && agentRows.length) form.agentId = agentRows[0].id;
  } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao carregar túneis."; }
  finally { loading.value = false; }
}
async function submit() {
  loading.value = true; error.value = ""; info.value = "";
  try {
    const tunnel = await createTunnel({ agentId: form.agentId, name: form.name, protocol: form.protocol,
      hostname: isWeb.value && form.hostname.trim() ? form.hostname.trim() : undefined,
      publicPort: !isWeb.value && form.publicPort ? Number(form.publicPort) : undefined,
      targetPort: Number(form.targetPort), autoDns: isWeb.value && form.autoDns, transport: form.transport });
    info.value = `Túnel criado: ${tunnel.endpoint}`; await load();
  } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao criar túnel."; }
  finally { loading.value = false; }
}
async function remove(row: Record<string, unknown>) { if (!window.confirm(`Remover o túnel ${String(row.name || row.id)}?`)) return; try { await deleteTunnel(String(row.id)); await load(); } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao remover túnel."; } }
async function copyEndpoint(row: Record<string, unknown>) { await navigator.clipboard.writeText(String(row.endpoint || "")); info.value = "Endpoint copiado."; }
onMounted(load);
</script>
<template>
  <BasePage title="Túneis" subtitle="Publicação HTTP, HTTPS, TCP e UDP por agentes conectados." eyebrow="Tunnara Platform 1.0" icon="tunnel">
    <template #actions><button class="primary" type="button" :disabled="loading" @click="load">{{ loading ? "Atualizando..." : "Atualizar" }}</button></template>
    <ControlAccessPanel @saved="load" />
    <div v-if="error" class="alert error">{{ error }}</div><div v-if="info" class="alert info">{{ info }}</div>
    <BaseSectionCard title="Novo túnel" subtitle="O Agent escolhido deve estar conectado ao Relay.">
      <div class="grid two-cols">
        <div class="field"><label>Agente</label><select v-model="form.agentId"><option value="" disabled>Selecione</option><option v-for="agent in agents" :key="agent.id" :value="agent.id">{{ agent.name }} — {{ agent.status }}</option></select></div>
        <div class="field"><label>Nome</label><input v-model="form.name" type="text" /></div>
        <div class="field"><label>Protocolo</label><select v-model="form.protocol"><option value="http">HTTP</option><option value="https">HTTPS</option><option value="tcp">TCP</option><option value="udp">UDP</option></select></div>
        <div class="field"><label>Transporte Agent/Relay</label><select v-model="form.transport"><option value="auto">Automático</option><option value="tcp">TCP/TLS</option><option value="quic">QUIC quando disponível</option></select></div>
        <div v-if="isWeb" class="field"><label>Hostname público opcional</label><input v-model="form.hostname" type="text" placeholder="erp.tunnel.exemplo.com" /></div>
        <div v-else class="field"><label>Porta pública opcional</label><input v-model.number="form.publicPort" type="number" min="0" max="65535" placeholder="Alocação automática" /></div>
        <div class="field"><label>Porta local</label><input v-model.number="form.targetPort" type="number" min="1" max="65535" /></div>
        <label v-if="isWeb" class="field"><span>DNS Cloudflare</span><input v-model="form.autoDns" type="checkbox" /> Criar/remover subdomínio automaticamente</label>
      </div>
      <div class="actions top-gap-12"><button class="primary" type="button" :disabled="loading || !form.agentId" @click="submit">Criar túnel</button></div>
    </BaseSectionCard>
    <BaseSectionCard title="Túneis cadastrados" subtitle="Rotas persistidas e utilizadas pelo Edge em tempo real.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhum túnel cadastrado."><template #actions="{ row }"><div class="actions"><button class="secondary compact-button" type="button" @click="copyEndpoint(row)">Copiar</button><button class="secondary compact-button" type="button" @click="remove(row)">Excluir</button></div></template></BaseDataGrid>
    </BaseSectionCard>
  </BasePage>
</template>
