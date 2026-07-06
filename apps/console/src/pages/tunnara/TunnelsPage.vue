<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { createTunnel, deleteTunnel, listAgents, listPolicies, listTunnels, type TrafficPolicy, type TunnaraAgent, type TunnaraTunnel } from "../../services/tunnaraApi";

const columns = [
  { key: "name", label: "Nome" }, { key: "protocol", label: "Protocolo" },
  { key: "endpoint", label: "Endpoint público" }, { key: "target", label: "Destino" },
  { key: "transport", label: "Transporte" }, { key: "health", label: "Saúde" },
  { key: "targetsCount", label: "Targets" }, { key: "status", label: "Status" },
];
const rows = ref<Record<string, unknown>[]>([]);
const agents = ref<TunnaraAgent[]>([]);
const policies = ref<TrafficPolicy[]>([]);
const loading = ref(false); const error = ref(""); const info = ref("");
const form = reactive({ agentId: "", name: "Aplicação HTTP", protocol: "http" as "http"|"https"|"tcp"|"udp", hostname: "", publicPort: 0, targetPort: 8080, autoDns: true, transport: "auto" as "auto"|"tcp"|"quic", policyId: "", inspectorEnabled: false, healthPath: "/healthz", healthEnabled: true });
const isWeb = computed(() => form.protocol === "http" || form.protocol === "https");

function mapTunnel(tunnel: TunnaraTunnel): Record<string, unknown> { return { ...tunnel, protocol: tunnel.protocol.toUpperCase(), health: tunnel.healthStatus || "unknown", targetsCount: tunnel.targets?.length || 1 }; }
async function load() {
  loading.value = true; error.value = "";
  try {
    const [tunnelRows, agentRows, policyRows] = await Promise.all([listTunnels(), listAgents(), listPolicies()]);
    rows.value = tunnelRows.map(mapTunnel); agents.value = agentRows; policies.value = policyRows;
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
      targetPort: Number(form.targetPort), autoDns: isWeb.value && form.autoDns, transport: form.transport,
      policyId: form.policyId || null, inspectorEnabled: isWeb.value && form.inspectorEnabled,
      targets: [{ agentId: form.agentId, name: "primary", targetHost: "127.0.0.1", targetPort: Number(form.targetPort), priority: 10, weight: 100,
        healthCheck: form.healthEnabled ? { type: isWeb.value ? "http" : "tcp", path: isWeb.value ? form.healthPath : undefined, intervalSeconds: 10, timeoutSeconds: 3, healthyThreshold: 2, unhealthyThreshold: 3 } : {} }],
    });
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
        <div v-if="isWeb" class="field"><label>Traffic Policy</label><select v-model="form.policyId"><option value="">Sem política</option><option v-for="policy in policies" :key="policy.id" :value="policy.id">{{ policy.name }}</option></select></div>
        <div v-if="isWeb && form.healthEnabled" class="field"><label>Health check</label><input v-model="form.healthPath" type="text" placeholder="/healthz" /></div>
        <label v-if="isWeb" class="field"><span>DNS Cloudflare</span><input v-model="form.autoDns" type="checkbox" /> Criar/remover subdomínio automaticamente</label>
        <label v-if="isWeb" class="field"><span>Request Inspector</span><input v-model="form.inspectorEnabled" type="checkbox" /> Capturar tráfego com redação de segredos</label>
        <label class="field"><span>Health checks</span><input v-model="form.healthEnabled" type="checkbox" /> Monitorar disponibilidade e habilitar failover</label>
      </div>
      <div class="actions top-gap-12"><button class="primary" type="button" :disabled="loading || !form.agentId" @click="submit">Criar túnel</button></div>
    </BaseSectionCard>
    <BaseSectionCard title="Túneis cadastrados" subtitle="Rotas persistidas e utilizadas pelo Edge em tempo real.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhum túnel cadastrado."><template #actions="{ row }"><div class="actions"><button class="secondary compact-button" type="button" @click="copyEndpoint(row)">Copiar</button><button class="secondary compact-button" type="button" @click="remove(row)">Excluir</button></div></template></BaseDataGrid>
    </BaseSectionCard>
  </BasePage>
</template>
