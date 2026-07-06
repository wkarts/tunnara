<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import BaseFormModal from "../../components/base/BaseFormModal.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { deleteInspection, getInspection, listInspections, listTunnels, purgeInspections, replayInspection, type RequestInspection, type TunnaraTunnel } from "../../services/tunnaraApi";

const inspections = ref<RequestInspection[]>([]); const tunnels = ref<TunnaraTunnel[]>([]); const selectedTunnel = ref("");
const selected = ref<RequestInspection | null>(null); const modalOpen = ref(false); const loading = ref(false); const error = ref(""); const info = ref("");
const columns = [{key:"method",label:"Método"},{key:"path",label:"Caminho"},{key:"status",label:"Status"},{key:"duration",label:"Duração"},{key:"source",label:"Origem"},{key:"created",label:"Data"}];
const rows = computed<Record<string, unknown>[]>(() => inspections.value.map((item) => ({...item,status:item.response_status ?? "-",duration:item.duration_ms == null?"-":`${item.duration_ms} ms`,source:item.source_ip || "-",created:new Date(item.created_at).toLocaleString("pt-BR")})));
function decodeBody(value: RequestInspection["request_body"]): string { if (!value?.data) return ""; try { return value.encoding === "base64" ? atob(value.data) : value.data; } catch { return value.data; } }
async function load(){loading.value=true;error.value="";try{const [inspectionRows,tunnelRows]=await Promise.all([listInspections(selectedTunnel.value,200),listTunnels()]);inspections.value=inspectionRows;tunnels.value=tunnelRows;}catch(err){error.value=err instanceof Error?err.message:"Falha ao carregar inspeções.";}finally{loading.value=false;}}
async function view(row:Record<string,unknown>){try{selected.value=await getInspection(String(row.id));modalOpen.value=true;}catch(err){error.value=err instanceof Error?err.message:"Falha ao abrir inspeção.";}}
async function replay(row:Record<string,unknown>){try{const result=await replayInspection(String(row.id));info.value=`Replay concluído com HTTP ${result.status}.`;await load();}catch(err){error.value=err instanceof Error?err.message:"Falha no replay.";}}
async function remove(row:Record<string,unknown>){if(!window.confirm("Excluir esta inspeção?"))return;try{await deleteInspection(String(row.id));await load();}catch(err){error.value=err instanceof Error?err.message:"Falha ao excluir.";}}
async function purge(){if(!window.confirm("Remover todas as inspeções armazenadas?"))return;try{const total=await purgeInspections(0);info.value=`${total} inspeções removidas.`;await load();}catch(err){error.value=err instanceof Error?err.message:"Falha na limpeza.";}}
onMounted(load);
</script>
<template>
  <BasePage title="Request Inspector" subtitle="Inspeção e replay de tráfego HTTP com redação automática de dados sensíveis." eyebrow="Tunnara Platform 2.0" icon="search">
    <template #actions><button class="secondary" type="button" :disabled="loading" @click="load">Atualizar</button><button class="secondary" type="button" @click="purge">Limpar histórico</button></template>
    <ControlAccessPanel @saved="load"/><div v-if="error" class="alert error">{{error}}</div><div v-if="info" class="alert info">{{info}}</div>
    <BaseSectionCard title="Filtro" subtitle="A captura precisa estar habilitada no túnel."><div class="field"><label>Túnel</label><select v-model="selectedTunnel" @change="load"><option value="">Todos</option><option v-for="tunnel in tunnels" :key="tunnel.id" :value="tunnel.id">{{tunnel.name}} — {{tunnel.hostname}}</option></select></div></BaseSectionCard>
    <BaseSectionCard title="Requisições capturadas" subtitle="Authorization, cookies e campos sensíveis de JSON são redigidos antes da persistência.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhuma inspeção capturada."><template #actions="{row}"><div class="actions"><button class="secondary compact-button" @click="view(row)">Detalhes</button><button class="secondary compact-button" @click="replay(row)">Replay</button><button class="secondary compact-button" @click="remove(row)">Excluir</button></div></template></BaseDataGrid>
    </BaseSectionCard>
    <BaseFormModal :open="modalOpen" title="Detalhes da requisição" size="xl" @close="modalOpen=false" @save="modalOpen=false">
      <div v-if="selected" class="inspection-details">
        <div class="grid two-cols"><div><strong>{{selected.method}} {{selected.path}}</strong></div><div>HTTP {{selected.response_status ?? '-' }} • {{selected.duration_ms ?? '-'}} ms</div></div>
        <h4>Headers da requisição</h4><pre>{{JSON.stringify(selected.request_headers,null,2)}}</pre>
        <h4>Corpo da requisição</h4><pre>{{decodeBody(selected.request_body) || '(vazio)'}}</pre>
        <h4>Headers da resposta</h4><pre>{{JSON.stringify(selected.response_headers,null,2)}}</pre>
        <h4>Corpo da resposta</h4><pre>{{decodeBody(selected.response_body) || '(vazio)'}}</pre>
      </div>
    </BaseFormModal>
  </BasePage>
</template>
<style scoped>.inspection-details pre{max-height:240px;overflow:auto;padding:12px;border-radius:8px;background:var(--surface-muted,#101827);font-size:12px;white-space:pre-wrap;word-break:break-word}.inspection-details h4{margin:18px 0 6px}</style>
