#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" -eq 0 ]] || { echo "Execute como root." >&2; exit 1; }
for service in tunnara-agent tunnara-server; do
  systemctl disable --now "$service.service" 2>/dev/null || true
  rm -f "/etc/systemd/system/$service.service"
done
systemctl daemon-reload
rm -f /usr/local/bin/tunnara /usr/local/bin/tunnara-server
echo "Binários removidos. Dados em /var/lib/tunnara e /var/lib/tunnara-agent foram preservados."
