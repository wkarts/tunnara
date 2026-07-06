<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import BaseFormModal from "../../components/base/BaseFormModal.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { createPolicy, deletePolicy, listPolicies, updatePolicy, type TrafficPolicy } from "../../services/tunnaraApi";

const policies = ref<TrafficPolicy[]>([]);
const loading = ref(false);
const error = ref("");
const info = ref("");
const modalOpen = ref(false);
const editingId = ref("");
const form = reactive({ name: "", description: "", enabled: true, documentText: "" });
const columns = [
  { key: "name", label: "Política" },
  { key: "effect", label: "Padrão" },
  { key: "rules", label: "Regras" },
  { key: "enabledLabel", label: "Status" },
  { key: "updatedAt", label: "Atualizada" },
];
const rows = computed<Record<string, unknown>[]>(() => policies.value.map((policy) => ({
  ...policy,
  effect: String(policy.document?.defaultEffect || "deny").toUpperCase(),
  rules: Array.isArray(policy.document?.rules) ? policy.document.rules.length : 0,
  enabledLabel: policy.enabled ? "Ativa" : "Inativa",
  updatedAt: policy.updated_at ? new Date(policy.updated_at).toLocaleString("pt-BR") : "-",
})));

const templates = {
  zeroTrust: {
    defaultEffect: "deny",
    rules: [
      { name: "Health check público", match: { pathPrefix: "/healthz" }, actions: [{ type: "allow" }] },
      { name: "Rede corporativa", match: { sourceCidrs: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"] }, actions: [{ type: "allow" }] },
    ],
  },
  basicAuth: {
    defaultEffect: "deny",
    rules: [{ name: "Autenticação básica", match: { pathPrefix: "/" }, actions: [
      { type: "basic_auth", realm: "Tunnara", accounts: [{ username: "admin", password: "ALTERE-E-ME" }] },
      { type: "rate_limit", requests: 120, windowSeconds: 60 },
      { type: "remove_request_headers", headers: ["authorization"] },
      { type: "allow" },
    ] }],
  },
  oidc: {
    defaultEffect: "deny",
    rules: [{ name: "OIDC corporativo", match: { pathPrefix: "/" }, actions: [
      { type: "oidc", issuer: "https://id.exemplo.com", audience: "tunnara", requiredClaims: { email_verified: true } },
      { type: "add_request_headers", headers: { "x-tunnara-policy": "oidc" } },
      { type: "allow" },
    ] }],
  },
};

function documentForTemplate(name: keyof typeof templates) { return JSON.stringify(templates[name], null, 2); }
function resetForm(template: keyof typeof templates = "zeroTrust") {
  editingId.value = ""; form.name = "Nova política"; form.description = ""; form.enabled = true; form.documentText = documentForTemplate(template);
}
function openCreate(template: keyof typeof templates = "zeroTrust") { resetForm(template); modalOpen.value = true; }
function openEdit(row: Record<string, unknown>) {
  const policy = policies.value.find((item) => item.id === String(row.id)); if (!policy) return;
  editingId.value = policy.id; form.name = policy.name; form.description = policy.description || ""; form.enabled = policy.enabled;
  form.documentText = JSON.stringify(policy.document || {}, null, 2); modalOpen.value = true;
}
async function load() {
  loading.value = true; error.value = "";
  try { policies.value = await listPolicies(); }
  catch (err) { error.value = err instanceof Error ? err.message : "Falha ao carregar políticas."; }
  finally { loading.value = false; }
}
async function save() {
  error.value = ""; info.value = "";
  try {
    const document = JSON.parse(form.documentText) as Record<string, unknown>;
    if (!form.name.trim()) throw new Error("Informe o nome da política.");
    if (editingId.value) await updatePolicy(editingId.value, { name: form.name.trim(), description: form.description, enabled: form.enabled, document });
    else await createPolicy({ name: form.name.trim(), description: form.description, enabled: form.enabled, document });
    modalOpen.value = false; info.value = "Política salva e disponibilizada ao Edge."; await load();
  } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao salvar política."; }
}
async function remove(row: Record<string, unknown>) {
  if (!window.confirm(`Excluir a política ${String(row.name)}?`)) return;
  try { await deletePolicy(String(row.id)); info.value = "Política removida."; await load(); }
  catch (err) { error.value = err instanceof Error ? err.message : "Falha ao excluir política."; }
}
onMounted(load);
</script>

<template>
  <BasePage title="Traffic Policies" subtitle="Zero Trust, autenticação, rate limit e transformação de tráfego executados no Edge." eyebrow="Tunnara Platform 2.0" icon="shield">
    <template #actions>
      <button class="secondary" type="button" :disabled="loading" @click="load">{{ loading ? "Atualizando..." : "Atualizar" }}</button>
      <button class="primary" type="button" @click="openCreate()">Nova política</button>
    </template>
    <ControlAccessPanel @saved="load" />
    <div v-if="error" class="alert error">{{ error }}</div><div v-if="info" class="alert info">{{ info }}</div>
    <BaseSectionCard title="Modelos seguros" subtitle="Use um modelo e ajuste o documento JSON antes de aplicar aos túneis.">
      <div class="actions policy-templates">
        <button class="secondary" type="button" @click="openCreate('zeroTrust')">Zero Trust por rede</button>
        <button class="secondary" type="button" @click="openCreate('basicAuth')">Basic Auth + rate limit</button>
        <button class="secondary" type="button" @click="openCreate('oidc')">OIDC / JWT</button>
      </div>
    </BaseSectionCard>
    <BaseSectionCard title="Políticas cadastradas" subtitle="Políticas em uso não podem ser excluídas até serem removidas dos túneis.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhuma política cadastrada.">
        <template #actions="{ row }"><div class="actions"><button class="secondary compact-button" type="button" @click="openEdit(row)">Editar</button><button class="secondary compact-button" type="button" @click="remove(row)">Excluir</button></div></template>
      </BaseDataGrid>
    </BaseSectionCard>
    <BaseFormModal :open="modalOpen" :title="editingId ? 'Editar política' : 'Nova política'" subtitle="O documento é validado e segredos são convertidos para hashes no servidor." size="xl" @close="modalOpen=false" @save="save">
      <div class="grid two-cols">
        <div class="field"><label>Nome</label><input v-model="form.name" type="text" /></div>
        <label class="field"><span>Status</span><select v-model="form.enabled"><option :value="true">Ativa</option><option :value="false">Inativa</option></select></label>
      </div>
      <div class="field top-gap-12"><label>Descrição</label><input v-model="form.description" type="text" /></div>
      <div class="field top-gap-12"><label>Documento da política</label><textarea v-model="form.documentText" rows="22" spellcheck="false" class="policy-editor"></textarea></div>
    </BaseFormModal>
  </BasePage>
</template>

<style scoped>
.policy-templates{flex-wrap:wrap}.policy-editor{width:100%;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre;resize:vertical}
</style>
