#!/usr/bin/env bash
set -Eeuo pipefail

OUTPUT="${1:-}"
[[ -n "$OUTPUT" ]] || { echo 'Uso: base64-decode.sh <arquivo-saida>' >&2; exit 2; }
mkdir -p "$(dirname "$OUTPUT")"
if base64 --help 2>&1 | grep -q -- '--decode'; then
  base64 --decode > "$OUTPUT"
else
  base64 -D > "$OUTPUT"
fi
chmod 600 "$OUTPUT"
