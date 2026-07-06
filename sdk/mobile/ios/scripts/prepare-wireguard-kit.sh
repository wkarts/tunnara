#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-${TUNNARA_WIREGUARD_SOURCE:-$ROOT/.wireguard-apple}}"

if [[ ! -d "$SOURCE" ]]; then
  git clone --depth 1 --branch 1.0.16-27 https://git.zx2c4.com/wireguard-apple "$SOURCE"
fi

# Xcode 16+ exige os tipos C99 explícitos. O patch é intencionalmente idempotente.
while IFS= read -r -d '' header; do
  if ! grep -q '^#include <stdint.h>' "$header"; then
    tmp="${header}.tunnara.tmp"
    { printf '#include <stdint.h>\n'; cat "$header"; } > "$tmp"
    mv "$tmp" "$header"
  fi
  perl -0pi -e 's/\bu_int32_t\b/uint32_t/g; s/\bu_int16_t\b/uint16_t/g; s/\bu_char\b/uint8_t/g' "$header"
done < <(grep -rlZE '\b(u_int32_t|u_int16_t|u_char)\b' "$SOURCE/Sources" --include='*.h' 2>/dev/null || true)

while IFS= read -r -d '' makefile; do
  perl -0pi -e 's/^(GOOS_iphonesimulator\s*:?=\s*)\S+/$1ios/m' "$makefile"
done < <(find "$SOURCE" -type f \( -name Makefile -o -name '*.mk' \) -print0)

echo "WireGuardKit preparado em $SOURCE."
