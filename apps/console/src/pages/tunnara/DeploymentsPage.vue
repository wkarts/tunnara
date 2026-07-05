<script setup lang="ts">
import TunnaraResourcePage from "./TunnaraResourcePage.vue";
const columns = [{"key": "name", "label": "Instalação"}, {"key": "mode", "label": "Modo"}, {"key": "version", "label": "Versão"}, {"key": "environment", "label": "Ambiente"}, {"key": "status", "label": "Status"}];
const rows = [{"id": 1, "name": "VPS Principal", "mode": "Docker Compose", "version": "1.0.0", "environment": "Produção", "status": "Disponível"}, {"id": 2, "name": "CloudPanel Homologação", "mode": "Native/Systemd", "version": "1.0.0", "environment": "Homologação", "status": "Disponível"}];
</script>
<template><TunnaraResourcePage title="Implantações" subtitle="Instalações Docker, CloudPanel, serviços nativos e atualizações." icon="package" action-label="Nova implantação" :columns="columns" :rows="rows" /></template>
