#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="${ROOT}/.wireguard-apple"
if [[ ! -d "$CACHE/.git" ]]; then git clone --depth 1 --branch 1.0.16-27 https://git.zx2c4.com/wireguard-apple "$CACHE"; fi
make -C "$CACHE/Sources/WireGuardKitGo"
echo "WireGuardKitGo preparado em $CACHE. Vincule o artefato produzido ao target TunnaraPacketTunnel conforme a documentação oficial."
