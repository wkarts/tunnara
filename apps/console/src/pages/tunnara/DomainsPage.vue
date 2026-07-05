<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import BasePage from "../../components/base/BasePage.vue";
import BaseSectionCard from "../../components/base/BaseSectionCard.vue";
import BaseDataGrid from "../../components/base/BaseDataGrid.vue";
import ControlAccessPanel from "../../components/ControlAccessPanel.vue";
import { bootstrapCloudflareDns, configureCloudflare, deleteDnsRecord, getCloudflareIntegration, listDnsRecords, testCloudflare, type DnsRecord } from "../../services/tunnaraApi";

const columns = [{ key: "type", label: "Tipo" }, { key: "name", label: "Nome" }, { key: "content", label: "Destino" }, { key: "proxiedLabel", label: "Proxy" }, { key: "status", label: "Status" }];
const rows = ref<Record<string, unknown>[]>([]); const loading = ref(false); const error = ref(""); const info = ref(""); const hasSecret = ref(false);
const form = reactive({ apiToken: "", zoneId: "", zoneName: "", managedDomain: "", edgeHostname: "", edgeAddress: "", acmeEmail: "", proxied: false, dnsMode: "wildcard" as "wildcard"|"per-tunnel", acmeStaging: true });
function mapRow(row: DnsRecord) { return { ...row, proxiedLabel: row.proxied ? "Ativo" : "DNS only" }; }
async function load() {
  loading.value = true; error.value = "";
  try {
    const [integration, dns] = await Promise.all([getCloudflareIntegration(), listDnsRecords()]);
    rows.value = dns.map(mapRow); hasSecret.value = Boolean(integration?.hasSecret);
    const config = integration?.config || {};
    form.zoneId = String(config.zoneId || ""); form.zoneName = String(config.zoneName || ""); form.managedDomain = String(config.managedDomain || "");
    form.edgeHostname = String(config.edgeHostname || ""); form.edgeAddress = String(config.edgeAddress || "");
    form.acmeEmail = String(config.acmeEmail || ""); form.proxied = Boolean(config.proxied);
    form.dnsMode = config.dnsMode === "per-tunnel" ? "per-tunnel" : "wildcard"; form.acmeStaging = Boolean(config.acmeStaging);
  } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao carregar Cloudflare/DNS."; }
  finally { loading.value = false; }
}
async function save() {
  loading.value = true; error.value = ""; info.value = "";
  try {
    await configureCloudflare({ apiToken: form.apiToken.trim() || undefined, zoneId: form.zoneId.trim() || undefined, zoneName: form.zoneName, managedDomain: form.managedDomain,
      edgeHostname: form.edgeHostname.trim() || undefined, edgeAddress: form.edgeAddress.trim() || undefined,
      acmeEmail: form.acmeEmail.trim() || undefined, proxied: form.proxied, dnsMode: form.dnsMode, acmeStaging: form.acmeStaging });
    form.apiToken = ""; info.value = "Integração Cloudflare salva com token criptografado."; await load();
  } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao salvar integração."; }
  finally { loading.value = false; }
}
async function test() { try { const result = await testCloudflare(); info.value = `Cloudflare validada. Zona: ${String(result.zoneName || result.zoneId || "OK")}`; } catch (err) { error.value = err instanceof Error ? err.message : "Falha no teste."; } }
async function bootstrap() { try { await bootstrapCloudflareDns(); info.value = "Registros base e wildcard criados/atualizados."; await load(); } catch (err) { error.value = err instanceof Error ? err.message : "Falha no bootstrap DNS."; } }
async function remove(row: Record<string, unknown>) { if (!window.confirm(`Excluir ${String(row.name)} da Cloudflare?`)) return; try { await deleteDnsRecord(String(row.id)); await load(); } catch (err) { error.value = err instanceof Error ? err.message : "Falha ao excluir registro."; } }
onMounted(load);
</script>
<template>
  <BasePage title="Domínios, Cloudflare e TLS" subtitle="Subdomínios automáticos, wildcard DNS e Let's Encrypt por DNS-01." eyebrow="Tunnara Platform 1.0" icon="globe">
    <template #actions><button class="primary" :disabled="loading" @click="load">Atualizar</button></template>
    <ControlAccessPanel @saved="load" /><div v-if="error" class="alert error">{{ error }}</div><div v-if="info" class="alert info">{{ info }}</div>
    <BaseSectionCard title="Integração Cloudflare" subtitle="Use um API Token restrito à zona com permissões DNS:Edit e Zone:Read.">
      <div class="grid two-cols">
        <div class="field"><label>API Token {{ hasSecret ? "(já configurado)" : "" }}</label><input v-model="form.apiToken" type="password" placeholder="Deixe vazio para preservar" /></div>
        <div class="field"><label>Zone ID opcional</label><input v-model="form.zoneId" type="text" /></div>
        <div class="field"><label>Zona Cloudflare</label><input v-model="form.zoneName" type="text" placeholder="exemplo.com" /></div>
        <div class="field"><label>Domínio gerenciado Tunnara</label><input v-model="form.managedDomain" type="text" placeholder="tunnel.exemplo.com" /></div>
        <div class="field"><label>E-mail ACME</label><input v-model="form.acmeEmail" type="email" /></div>
        <div class="field"><label>IP público do Edge</label><input v-model="form.edgeAddress" type="text" placeholder="203.0.113.10" /></div>
        <div class="field"><label>Hostname CNAME do Edge</label><input v-model="form.edgeHostname" type="text" placeholder="edge.exemplo.net" /></div>
        <div class="field"><label>Modo DNS</label><select v-model="form.dnsMode"><option value="wildcard">Wildcard + registros base</option><option value="per-tunnel">Um registro por túnel</option></select></div>
        <label class="field"><span>Ambiente ACME</span><input v-model="form.acmeStaging" type="checkbox" /> Usar Let's Encrypt staging durante testes</label>
        <label class="field"><span>Proxy Cloudflare</span><input v-model="form.proxied" type="checkbox" /> Ativar nuvem laranja para registros compatíveis</label>
      </div>
      <div class="actions top-gap-12"><button class="primary" :disabled="loading" @click="save">Salvar</button><button class="secondary" @click="test">Testar token/zona</button><button class="secondary" @click="bootstrap">Criar DNS base + wildcard</button></div>
    </BaseSectionCard>
    <BaseSectionCard title="Registros DNS administrados" subtitle="Registros criados pelo Tunnara e removidos junto com o túnel quando aplicável.">
      <BaseDataGrid :rows="rows" :columns="columns" empty-text="Nenhum registro DNS administrado."><template #actions="{ row }"><button class="secondary compact-button" @click="remove(row)">Excluir</button></template></BaseDataGrid>
    </BaseSectionCard>
  </BasePage>
</template>
