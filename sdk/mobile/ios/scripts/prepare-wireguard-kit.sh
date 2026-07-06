#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-${TUNNARA_WIREGUARD_APPLE_DIR:-}}"

if [[ -z "$SOURCE" ]]; then
  SOURCE="$ROOT/.wireguard-apple"
  if [[ ! -d "$SOURCE/.git" ]]; then
    git clone --depth 1 --branch 1.0.16-27 https://git.zx2c4.com/wireguard-apple "$SOURCE"
  fi
fi

[[ -d "$SOURCE" ]] || { echo "Checkout wireguard-apple não encontrado: $SOURCE" >&2; exit 1; }

python3 - "$SOURCE" <<'PYWG'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
package_manifest = source / 'Package.swift'
if not package_manifest.is_file():
    raise SystemExit(f'Package.swift não encontrado em {source}')
manifest = package_manifest.read_text(errors='ignore')
updated_manifest = re.sub(
    r'^//\s*swift-tools-version:[^\n]+',
    '// swift-tools-version:5.9',
    manifest,
    count=1,
    flags=re.M,
)
if updated_manifest == manifest and 'swift-tools-version:' not in manifest:
    updated_manifest = '// swift-tools-version:5.9\n' + manifest
if updated_manifest != manifest:
    package_manifest.write_text(updated_manifest)
replacements = {
    'u_int32_t': 'uint32_t',
    'u_int16_t': 'uint16_t',
    'u_char': 'uint8_t',
}
patched = 0

for header in (source / 'Sources').rglob('*.h'):
    text = header.read_text(errors='ignore')
    updated = text
    for old, new in replacements.items():
        updated = updated.replace(old, new)
    if updated != text and '#include <stdint.h>' not in updated:
        lines = updated.splitlines()
        insert_at = 0
        while insert_at < len(lines) and (
            lines[insert_at].startswith('/*')
            or lines[insert_at].startswith(' *')
            or lines[insert_at].startswith('*/')
            or not lines[insert_at].strip()
        ):
            insert_at += 1
        lines.insert(insert_at, '#include <stdint.h>')
        updated = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    if updated != text:
        header.write_text(updated)
        patched += 1

for makefile in (source / 'Sources').rglob('Makefile'):
    text = makefile.read_text(errors='ignore')
    updated = text
    if 'GOOS_iphonesimulator :=' in updated:
        updated = re.sub(
            r'^GOOS_iphonesimulator\s*:=.*$',
            'GOOS_iphonesimulator := ios',
            updated,
            flags=re.M,
        )
    elif 'GOOS_iphoneos :=' in updated:
        updated += '\nGOOS_iphonesimulator := ios\n'
    if updated != text:
        makefile.write_text(updated)
        patched += 1

print(f'WireGuardKit preparado de forma idempotente em {source} ({patched} arquivo(s) ajustado(s)).')
PYWG
