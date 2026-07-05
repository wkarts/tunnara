#!/bin/sh
set -eu
source_dir="${CADDY_DATA_DIR:-/caddy-data/caddy/certificates}"
target_dir="${TARGET_DIR:-/certs}"
mkdir -p "$target_dir"
while true; do
  crt="$(find "$source_dir" -type f -name '*.crt' -path '*wildcard*' 2>/dev/null | head -n 1 || true)"
  if [ -n "$crt" ]; then
    key="${crt%.crt}.key"
    if [ -s "$key" ]; then
      cp "$crt" "$target_dir/fullchain.pem.tmp"
      cp "$key" "$target_dir/privkey.pem.tmp"
      chmod 644 "$target_dir/fullchain.pem.tmp"
      chmod 600 "$target_dir/privkey.pem.tmp"
      mv -f "$target_dir/fullchain.pem.tmp" "$target_dir/fullchain.pem"
      mv -f "$target_dir/privkey.pem.tmp" "$target_dir/privkey.pem"
      echo "Certificado wildcard exportado para o QUIC bridge."
    fi
  fi
  sleep 300
 done
