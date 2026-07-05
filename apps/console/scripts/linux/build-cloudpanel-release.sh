#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="$(cat "$ROOT_DIR/VERSION" 2>/dev/null || echo "1.1.14")"
APP_ID="tunnara-console"
CRATE_NAME="tunnara_console"
FEATURES="${FEATURES:-mysql-db,postgres-db}"
BUILD_WEB="${BUILD_WEB:-true}"
BUILD_MODE="${BUILD_MODE:-release}"
OUTPUT_DIR="$ROOT_DIR/release/cloudpanel"

TARGETS=()

usage() {
  cat <<USAGE
Uso:
  scripts/linux/build-cloudpanel-release.sh --x64
  scripts/linux/build-cloudpanel-release.sh --x86
  scripts/linux/build-cloudpanel-release.sh --all

Variáveis opcionais:
  FEATURES=mysql-db,postgres-db   Recursos Cargo habilitados no binário.
  BUILD_WEB=true|false            Rebuild do frontend antes de empacotar.
  BUILD_MODE=release              Modo Cargo.

Observação:
  x64 = x86_64-unknown-linux-gnu
  x86 = i686-unknown-linux-gnu

Para preparar Debian/Ubuntu:
  bash scripts/linux/install-cloudpanel-build-deps.sh --all
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --x64|--amd64)
      TARGETS+=("x86_64-unknown-linux-gnu:x64")
      ;;
    --x86|--i686|--32)
      TARGETS+=("i686-unknown-linux-gnu:x86")
      ;;
    --all)
      TARGETS+=("x86_64-unknown-linux-gnu:x64" "i686-unknown-linux-gnu:x86")
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Parâmetro inválido: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS+=("x86_64-unknown-linux-gnu:x64")
fi

command -v cargo >/dev/null 2>&1 || {
  echo "Cargo/Rust não encontrado. Instale Rust antes de compilar."
  exit 1
}
command -v npm >/dev/null 2>&1 || {
  echo "Node/npm não encontrado. Instale Node.js antes de compilar o frontend."
  exit 1
}

cd "$ROOT_DIR"
mkdir -p "$OUTPUT_DIR"

if [[ "$BUILD_WEB" == "true" ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run build:web
  node ./scripts/prepare-tauri-resources.mjs || true
fi

if [[ ! -f "$ROOT_DIR/dist/index.html" ]]; then
  echo "dist/index.html não encontrado. Execute npm run build:web."
  exit 1
fi

if command -v rustup >/dev/null 2>&1; then
  for item in "${TARGETS[@]}"; do
    triple="${item%%:*}"
    rustup target add "$triple" || true
  done
fi

for item in "${TARGETS[@]}"; do
  triple="${item%%:*}"
  label="${item##*:}"
  package_name="${APP_ID}-cloudpanel-v${VERSION}-linux-${label}"
  stage_dir="$OUTPUT_DIR/$package_name"
  archive="$OUTPUT_DIR/${package_name}.tar.gz"

  echo "============================================================"
  echo "Build Linux $label ($triple)"
  echo "============================================================"

  cargo_env=()
  if [[ "$triple" == "i686-unknown-linux-gnu" ]]; then
    # Cross-build x86 em host x64 Debian/Ubuntu.
    # Requer multiarch i386 instalado pelo script install-cloudpanel-build-deps.sh.
    cargo_env+=("PKG_CONFIG_ALLOW_CROSS=1")
    cargo_env+=("PKG_CONFIG_LIBDIR=/usr/lib/i386-linux-gnu/pkgconfig:/usr/share/pkgconfig")
    cargo_env+=("PKG_CONFIG_PATH=/usr/lib/i386-linux-gnu/pkgconfig:/usr/share/pkgconfig")
    cargo_env+=("CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER=gcc")
    cargo_env+=("CFLAGS_i686_unknown_linux_gnu=-m32")
    cargo_env+=("CXXFLAGS_i686_unknown_linux_gnu=-m32")

    if ! env "${cargo_env[@]}" pkg-config --exists webkit2gtk-4.1; then
      echo "Dependências i386 do WebKitGTK 4.1 não encontradas para build x86."
      echo "Execute: bash scripts/linux/install-cloudpanel-build-deps.sh --x86"
      exit 1
    fi
  fi

  env "${cargo_env[@]}" cargo build \
    --manifest-path "$ROOT_DIR/src-tauri/Cargo.toml" \
    --target "$triple" \
    --release \
    --features "$FEATURES"

  bin_path="$ROOT_DIR/src-tauri/target/$triple/release/$CRATE_NAME"
  if [[ ! -x "$bin_path" ]]; then
    echo "Binário não encontrado: $bin_path"
    exit 1
  fi

  rm -rf "$stage_dir"
  mkdir -p "$stage_dir/bin" "$stage_dir/dist" "$stage_dir/data" "$stage_dir/logs"

  cp "$bin_path" "$stage_dir/bin/$CRATE_NAME"
  chmod +x "$stage_dir/bin/$CRATE_NAME"

  cp -a "$ROOT_DIR/dist/." "$stage_dir/dist/"
  cp -a "$ROOT_DIR/deploy/cloudpanel/." "$stage_dir/"
  cp "$ROOT_DIR/deploy/cloudpanel/.env.example" "$stage_dir/.env"

  chmod +x "$stage_dir"/*.sh
  chmod +x "$stage_dir/bin/$CRATE_NAME"

  cat > "$stage_dir/RELEASE-MANIFEST.txt" <<MANIFEST
Tunnara Console CloudPanel Release
Versão: $VERSION
Arquitetura: linux-$label
Target Rust: $triple
Binário: bin/$CRATE_NAME
Frontend: dist/index.html
Recursos Cargo: $FEATURES
Data de build: $(date -Is)

Execução CloudPanel:
  npm start

Execução terminal:
  ./start.sh
  ./status.sh
  ./logs.sh
MANIFEST

  tar -C "$OUTPUT_DIR" -czf "$archive" "$package_name"
  sha256sum "$archive" > "$archive.sha256"
  echo "Gerado: $archive"
  echo "SHA256: $archive.sha256"
done
