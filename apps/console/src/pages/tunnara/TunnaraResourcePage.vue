<script setup lang="ts">
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";

withDefaults(defineProps<{
  title: string;
  subtitle: string;
  icon: string;
  actionLabel?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  statusTitle?: string;
  statusText?: string;
}>(), {
  actionLabel: "Adicionar",
  statusTitle: "Estado operacional",
  statusText: "Estrutura preparada para integração com o control plane.",
});
</script>

<template>
  <BasePage :title="title" :subtitle="subtitle" eyebrow="Tunnara Platform" :icon="icon">
    <template #actions>
      <button class="secondary" type="button">Atualizar</button>
      <button class="primary" type="button">{{ actionLabel }}</button>
    </template>
    <div class="dashboard-grid-main">
      <BaseSectionCard :title="statusTitle" :subtitle="statusText">
        <div class="status-list">
          <div class="status-row"><span>Control plane</span><strong class="status-success">Preparado</strong></div>
          <div class="status-row"><span>Persistência</span><strong>PostgreSQL</strong></div>
          <div class="status-row"><span>Atualização em tempo real</span><strong>NATS / WebSocket</strong></div>
        </div>
      </BaseSectionCard>
      <BaseSectionCard title="Modelo operacional" subtitle="Tela herdada do visual core do template e adaptada ao domínio Tunnara.">
        <p class="muted-text">Os dados demonstrativos serão substituídos automaticamente pelas respostas da API quando VITE_TUNNARA_API_URL estiver configurada.</p>
      </BaseSectionCard>
    </div>
    <BaseSectionCard :title="title" subtitle="Recursos cadastrados e estado atual.">
      <BaseDataGrid :rows="rows" :columns="columns">
        <template #actions>
          <button class="secondary compact-button" type="button">Detalhes</button>
        </template>
      </BaseDataGrid>
    </BaseSectionCard>
  </BasePage>
</template>
