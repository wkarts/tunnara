#!/bin/sh
set -eu
if [ "${1:-}" = "server" ]; then
  cert="${TUNNARA_QUIC_CERT:-/certs/fullchain.pem}"
  key="${TUNNARA_QUIC_KEY:-/certs/privkey.pem}"
  timeout="${TUNNARA_QUIC_CERT_WAIT_SECONDS:-180}"
  elapsed=0
  while [ ! -s "$cert" ] || [ ! -s "$key" ]; do
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "Certificado QUIC não ficou disponível em ${timeout}s." >&2
      exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
fi
exec /usr/local/bin/tunnara-quic-bridge "$@"
