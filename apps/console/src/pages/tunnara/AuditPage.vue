<script setup lang="ts">
import { onMounted, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { listAudit } from "../../services/tunnaraApi";

const columns = [
  { key: "createdAt", label: "Data/Hora" },
  { key: "actor", label: "Ator" },
  { key: "event", label: "Evento" },
  { key: "resource", label: "Recurso" },
  { key: "result", label: "Resultado" },
];
const rows = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = (await listAudit()).map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at).toLocaleString("pt-BR"),
      actor: `${row.actor_type}${row.actor_id ? `:${row.actor_id.slice(0, 8)}` : ""}`,
      event: row.event,
      resource: row.resource_type ? `${row.resource_type}:${row.resource_id || "-"}` : "-",
      result: row.result,
    }));
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Falha ao carregar auditoria.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <BasePage title="Auditoria" subtitle="Eventos administrativos, provisionamento, agentes e túneis." eyebrow="Tunnara Platform" icon="clipboard">
    <template #actions><button class="primary" type="button" :disabled="loading" @click="load">Atualizar</button></template>
    <ControlAccessPanel @saved="load" />
    <div v-if="error" class="alert error">{{ error }}</div>
    <BaseSectionCard title="Eventos recentes" subtitle="Registro persistente por organização.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhum evento encontrado." />
    </BaseSectionCard>
  </BasePage>
</template>
