<script setup lang="ts">
import TunnaraResourcePage from "./TunnaraResourcePage.vue";
const columns = [{"key": "name", "label": "Política"}, {"key": "scope", "label": "Escopo"}, {"key": "rules", "label": "Regras"}, {"key": "priority", "label": "Prioridade"}, {"key": "status", "label": "Status"}];
const rows = [{"id": 1, "name": "Administradores", "scope": "Organização", "rules": 8, "priority": 100, "status": "Ativa"}, {"id": 2, "name": "Suporte temporário", "scope": "Túnel SSH", "rules": 3, "priority": 50, "status": "Ativa"}];
</script>
<template><TunnaraResourcePage title="Políticas de acesso" subtitle="RBAC, autenticação, allowlists e regras Zero Trust." icon="shield" action-label="Nova política" :columns="columns" :rows="rows" /></template>
