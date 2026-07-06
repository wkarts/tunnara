#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="${ROOT}/.wireguard-apple"
WIREGUARD_TAG="${TUNNARA_WIREGUARD_APPLE_TAG:-1.0.16-27}"
MANIFEST="${CACHE}/Package.swift"
TAG_MARKER="${CACHE}/.tunnara-wireguard-tag"

command -v git >/dev/null 2>&1 || {
  echo "git não encontrado; não é possível preparar WireGuardKit." >&2
  exit 1
}
command -v python3 >/dev/null 2>&1 || {
  echo "python3 não encontrado; não é possível corrigir o manifesto WireGuardKit." >&2
  exit 1
}

if [[ -d "$CACHE/.git" && ( ! -f "$TAG_MARKER" || "$(<"$TAG_MARKER")" != "$WIREGUARD_TAG" ) ]]; then
  rm -rf "$CACHE"
fi
if [[ ! -d "$CACHE/.git" ]]; then
  rm -rf "$CACHE"
  git clone --depth 1 --branch "$WIREGUARD_TAG" \
    https://git.zx2c4.com/wireguard-apple "$CACHE"
  printf '%s\n' "$WIREGUARD_TAG" > "$TAG_MARKER"
fi

[[ -f "$MANIFEST" ]] || {
  echo "Manifesto Swift do WireGuardKit não encontrado em $MANIFEST." >&2
  exit 1
}

# O tag 1.0.16-27 declara swift-tools-version 5.3, porém usa as plataformas
# macOS 12 e iOS 15, disponíveis somente a partir do PackageDescription 5.5.
# A correção local mantém o código e o tag upstream intactos e torna a resolução
# determinística nos runners Xcode 16+.
python3 - "$MANIFEST" <<'PY_PATCH'
from pathlib import Path
import re
import sys

manifest = Path(sys.argv[1])
source = manifest.read_text()
updated, count = re.subn(
    r"(?m)^//\s*swift-tools-version:\s*[0-9.]+\s*$",
    "// swift-tools-version:5.5",
    source,
    count=1,
)
if count != 1:
    raise SystemExit(f"Não foi possível ajustar swift-tools-version em {manifest}")
manifest.write_text(updated)
PY_PATCH

echo "WireGuardKit preparado em $CACHE usando o tag $WIREGUARD_TAG."
