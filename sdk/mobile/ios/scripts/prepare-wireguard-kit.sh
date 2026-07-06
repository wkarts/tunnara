#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="${ROOT}/.wireguard-apple"
WIREGUARD_TAG="${TUNNARA_WIREGUARD_APPLE_TAG:-1.0.16-27}"
MANIFEST="${CACHE}/Package.swift"
C_HEADER="${CACHE}/Sources/WireGuardKitC/WireGuardKitC.h"
GO_MAKEFILE="${CACHE}/Sources/WireGuardKitGo/Makefile"
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

for required_file in "$MANIFEST" "$C_HEADER" "$GO_MAKEFILE"; do
  [[ -f "$required_file" ]] || {
    echo "Arquivo obrigatório do WireGuardKit não encontrado: $required_file" >&2
    exit 1
  }
done

# O tag 1.0.16-27 declara swift-tools-version 5.3, porém usa as plataformas
# macOS 12 e iOS 15, disponíveis somente a partir do PackageDescription 5.5.
# A correção local mantém o código e o tag upstream intactos e torna a resolução
# determinística nos runners Xcode 16+.
python3 - "$MANIFEST" "$C_HEADER" "$GO_MAKEFILE" <<'PY_PATCH'
from pathlib import Path
import re
import sys

manifest = Path(sys.argv[1])
c_header = Path(sys.argv[2])
go_makefile = Path(sys.argv[3])

manifest_source = manifest.read_text()
manifest_updated, count = re.subn(
    r"(?m)^//\s*swift-tools-version:\s*[0-9.]+\s*$",
    "// swift-tools-version:5.5",
    manifest_source,
    count=1,
)
if count != 1:
    raise SystemExit(f"Não foi possível ajustar swift-tools-version em {manifest}")
manifest.write_text(manifest_updated)

# Xcode 16.4 passou a exigir que os tipos BSD usados pelo módulo C sejam
# importados explicitamente. Tipos C99 de largura fixa preservam o layout ABI
# e evitam a falha de importação modular de u_int32_t/u_int16_t/u_char.
header_source = c_header.read_text()
if '#include <stdint.h>' not in header_source:
    header_source = header_source.replace(
        '#include "key.h"',
        '#include <stdint.h>\n\n#include "key.h"',
        1,
    )
for old, new in (
    ('u_int32_t', 'uint32_t'),
    ('u_int16_t', 'uint16_t'),
    ('u_char', 'uint8_t'),
):
    header_source = re.sub(rf'\b{old}\b', new, header_source)
for forbidden in ('u_int32_t', 'u_int16_t', 'u_char'):
    if re.search(rf'\b{forbidden}\b', header_source):
        raise SystemExit(f"Tipo BSD não substituído em {c_header}: {forbidden}")
c_header.write_text(header_source)

# O Makefile upstream só mapeia iphoneos. Para o smoke build de simulador,
# iphonesimulator também deve produzir um archive GOOS=ios.
make_source = go_makefile.read_text()
if 'GOOS_iphonesimulator := ios' not in make_source:
    marker = 'GOOS_iphoneos := ios'
    if marker not in make_source:
        raise SystemExit(f"Mapeamento GOOS do iPhone não encontrado em {go_makefile}")
    make_source = make_source.replace(
        marker,
        marker + '\nGOOS_iphonesimulator := ios',
        1,
    )
go_makefile.write_text(make_source)
PY_PATCH

echo "WireGuardKit preparado em $CACHE usando o tag $WIREGUARD_TAG, com compatibilidade Xcode 16 e iOS Simulator."
