# Kubernetes e Helm

O chart fica em `deploy/helm/tunnara`.

```bash
helm upgrade --install tunnara deploy/helm/tunnara \
  --namespace tunnara --create-namespace \
  --set-string server.adminToken='tnr_admin_...' \
  --set-string server.masterKey='...' \
  --set-string server.clusterToken='tnr_cluster_...'
```

O chart inclui Deployment, Services, PVC, Ingress, HPA, PDB, NetworkPolicy e ServiceMonitor opcional.

Para produção distribuída, use PostgreSQL/Redis externos e um secret existente. A publicação dinâmica de faixas TCP/UDP depende do load balancer da infraestrutura e pode exigir `hostNetwork`, serviços dedicados ou integração com um operador futuro.
