<script setup lang="ts">
import { onMounted, ref } from "vue";
import DashboardMetricCard from "../components/dashboard/DashboardMetricCard.vue";
import DashboardHealthPanel from "../components/dashboard/DashboardHealthPanel.vue";
import DashboardQuickActions from "../components/dashboard/DashboardQuickActions.vue";
import DashboardRecentEvents from "../components/dashboard/DashboardRecentEvents.vue";
import DashboardChartCard from "../components/dashboard/DashboardChartCard.vue";
import AppPageTitleBar from "../components/base/AppPageTitleBar.vue";
import ControlAccessPanel from "../components/ControlAccessPanel.vue";
import { getControlBaseUrl, getControlToken, getPlatformOverview, type PlatformOverview } from "../services/tunnaraApi";

const loading = ref(false);
const error = ref("");
const overview = ref<PlatformOverview>({ agentsOnline: 0, tunnelsActive: 0, edgeNodesHealthy: 0, activeConnections: 0, trafficTodayGb: 0, alerts: 0 });
async function load() {
  loading.value = true; error.value = "";
  try { overview.value = await getPlatformOverview(); }
  catch (err) { error.value = err instanceof Error ? err.message : "Falha ao consultar o control plane."; }
  finally { loading.value = false; }
}
const quickActions = [
  { title: "Novo túnel", route: "/tuneis", icon: "tunnel" },
  { title: "Registrar agente", route: "/agentes", icon: "server" },
  { title: "Auditoria", route: "/auditoria", icon: "clipboard" },
  { title: "Diagnósticos", route: "/runtime", icon: "activity" },
];
const recentEvents = [
  { title: "Túnel HTTP funcional", subtitle: "Fluxo Edge → Relay → Agent → localhost disponível em produção", tone: "success" },
  { title: "Upgrade e WebSocket", subtitle: "Transporte bidirecional por stream validado no teste end-to-end", tone: "success" },
  { title: "Provisionamento seguro", subtitle: "Tokens de uso único e sessões de agente armazenadas por hash", tone: "info" },
  { title: "Transporte completo", subtitle: "QUIC, TCP/UDP, Cloudflare, ACME e WireGuard disponíveis na plataforma", tone: "warning" },
];
onMounted(load);
</script>
<template>
  <div class="page-content-scroll dashboard-page">
    <AppPageTitleBar title="Dashboard" subtitle="Visão operacional dos agentes, túneis, edges, relays e conexões." eyebrow="Tunnara Platform" icon="chart">
      <template #actions><button class="primary" :disabled="loading" @click="load">{{ loading ? "Atualizando..." : "Atualizar" }}</button></template>
    </AppPageTitleBar>
    <div v-if="error" class="alert error">{{ error }}</div>
    <ControlAccessPanel @saved="load" />
    <section class="dashboard-metrics-grid">
      <DashboardMetricCard title="Agentes online" :value="overview.agentsOnline" subtitle="Dispositivos conectados" icon="server" status="success" />
      <DashboardMetricCard title="Túneis ativos" :value="overview.tunnelsActive" subtitle="HTTP/HTTPS, TCP e UDP" icon="tunnel" status="info" />
      <DashboardMetricCard title="Edges saudáveis" :value="overview.edgeNodesHealthy" subtitle="Nós públicos disponíveis" icon="cloud" status="success" />
      <DashboardMetricCard title="Conexões" :value="overview.activeConnections" subtitle="Sessões simultâneas" icon="activity" status="info" />
      <DashboardMetricCard title="Tráfego hoje" :value="`${overview.trafficTodayGb.toFixed(2)} GB`" subtitle="Agregado na instalação" icon="chart" status="neutral" />
      <DashboardMetricCard title="Alertas" :value="overview.alerts" subtitle="Eventos que exigem atenção" icon="alert" :status="overview.alerts ? 'warning' : 'success'" />
    </section>
    <section class="dashboard-grid-main">
      <DashboardHealthPanel :items="[
        { label: 'Console', value: 'Online', status: 'success' },
        { label: 'Control API', value: getControlToken() ? getControlBaseUrl() : 'Token não informado', status: getControlToken() ? 'success' : 'warning' },
        { label: 'Edge', value: overview.edgeNodesHealthy ? 'Saudável' : 'Sem telemetria', status: overview.edgeNodesHealthy ? 'success' : 'warning' },
        { label: 'Relay', value: `${overview.activeConnections} requisições ativas`, status: 'info' }
      ]" />
      <DashboardQuickActions :actions="quickActions" />
    </section>
    <section class="dashboard-grid-secondary">
      <DashboardRecentEvents :rows="recentEvents" />
      <DashboardChartCard title="Conexões por intervalo" subtitle="Telemetria agregada do plano de dados"><div class="chart-placeholder">Conecte Prometheus/Grafana pelo stack de observabilidade</div></DashboardChartCard>
    </section>
  </div>
</template>
