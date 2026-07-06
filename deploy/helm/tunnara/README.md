# Helm Chart Tunnara

O chart instala o runtime Tunnara e o Console. A configuração padrão usa SQLite e uma réplica; para múltiplas réplicas do plano de controle, use o Control API distribuído com PostgreSQL/Redis e mantenha o runtime embedded em réplica única até concluir a migração operacional.

```bash
helm upgrade --install tunnara ./deploy/helm/tunnara \
  --namespace tunnara --create-namespace \
  --set-string server.bootstrapAdminToken="tnr_admin_..." \
  --set-string server.masterKeyBase64="..." \
  --set-string server.clusterToken="tnr_cluster_..." \
  --set server.baseDomain="tunnel.exemplo.com"
```

Recomenda-se fornecer um Secret previamente criado:

```bash
kubectl -n tunnara create secret generic tunnara-secrets \
  --from-literal=bootstrap-admin-token='tnr_admin_...' \
  --from-literal=master-key-base64='...' \
  --from-literal=cluster-token='tnr_cluster_...'

helm upgrade --install tunnara ./deploy/helm/tunnara \
  -n tunnara --create-namespace \
  --set server.existingSecret=tunnara-secrets
```

O intervalo dinâmico de portas TCP/UDP deve ser publicado pelo Load Balancer da infraestrutura ou por Edge Nodes dedicados com `hostNetwork`; Kubernetes Services não materializam automaticamente uma faixa arbitrária de portas.
