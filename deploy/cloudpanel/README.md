# Tunnara 0.2 no CloudPanel

1. Compile o Console com `npm --prefix apps/console ci && npm --prefix apps/console run build:web`.
2. Configure `TUNNARA_PUBLIC_CONTROL_URL`, `TUNNARA_PUBLIC_RELAY_URL` e `TUNNARA_BASE_DOMAIN` antes da instalação.
3. Execute `sudo ./deploy/cloudpanel/install-v0.2.sh`.
4. Crie um site estático no CloudPanel para o Console e aplique `nginx-console.conf`.
5. Crie um vhost wildcard separado para os túneis e aplique `nginx-edge.conf`.
6. Libere TCP 7300 no firewall para os agentes.

O CloudPanel gerencia o proxy e os certificados públicos. O processo Tunnara permanece em systemd e não depende do ciclo de vida da aplicação web do painel.
