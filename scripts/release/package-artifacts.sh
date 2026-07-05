#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(tr -d '[:space:]' < VERSION)"
PREFIX="tunnara-platform-v${VERSION}"
GITHUB_PREFIX="tunnara-platform"
WEB_PREFIX="tunnara-console-web-v${VERSION}"
RUNTIME_PREFIX="tunnara-runtime-linux-x64-v${VERSION}"
SDK_PREFIX="tunnara-sdk-c-linux-x64-v${VERSION}"
ARTIFACTS="$ROOT_DIR/artifacts"
STAGING="$(mktemp -d)"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

rm -rf "$ARTIFACTS"
mkdir -p "$ARTIFACTS"

[[ -f apps/console/dist/index.html ]] || { echo 'Execute npm run console:build antes de empacotar.' >&2; exit 1; }
[[ -x dist/tunnara-agent-linux-x64 && -x dist/tunnara-server-linux-x64 ]] || {
  echo 'Execute o build SEA Linux antes de empacotar.' >&2; exit 1;
}
node scripts/github/validate-repository.mjs

copy_project() {
  local destination="$1" include_builds="$2"
  local -a excludes=(
    --exclude='./.git'
    --exclude='./artifacts'
    --exclude='./node_modules'
    --exclude='./*/node_modules'
    --exclude='./target'
    --exclude='./*/target'
    --exclude='./vendor'
    --exclude='./*/vendor'
    --exclude='./.env'
    --exclude='./*/.env'
    --exclude='./.build'
    --exclude='./data'
    --exclude='./backups'
    --exclude='./*.sqlite'
    --exclude='./*.sqlite-wal'
    --exclude='./*.sqlite-shm'
  )
  if [[ "$include_builds" != 'true' ]]; then excludes+=(--exclude='./apps/console/dist' --exclude='./dist' --exclude='./sdk/c/build' --exclude='./sdk/mobile/android/.gradle' --exclude='./sdk/mobile/android/app/build'); fi
  mkdir -p "$destination"
  tar "${excludes[@]}" -cf - . | tar -C "$destination" -xf -
}

SOURCE_DIR="$STAGING/source/$PREFIX"
GITHUB_DIR="$STAGING/github/$GITHUB_PREFIX"
COMPLETE_DIR="$STAGING/complete/$PREFIX"
WEB_DIR="$STAGING/web/$WEB_PREFIX"
RUNTIME_DIR="$STAGING/runtime/$RUNTIME_PREFIX"
SDK_DIR="$STAGING/sdk/$SDK_PREFIX"

copy_project "$SOURCE_DIR" false
copy_project "$GITHUB_DIR" false
copy_project "$COMPLETE_DIR" true
mkdir -p "$WEB_DIR" "$RUNTIME_DIR/bin" "$RUNTIME_DIR/install" "$SDK_DIR/include" "$SDK_DIR/lib" "$SDK_DIR/examples"
cp -a apps/console/dist/. "$WEB_DIR/"
cp dist/tunnara-agent-linux-x64 "$RUNTIME_DIR/bin/tunnara"
cp dist/tunnara-server-linux-x64 "$RUNTIME_DIR/bin/tunnara-server"
cp -a deploy/standalone/linux/. "$RUNTIME_DIR/install/"
cp README.md VERSION LICENSE LICENSE-NOTICE.md SECURITY.md "$RUNTIME_DIR/"
cp sdk/c/include/tunnara.h "$SDK_DIR/include/"
cp sdk/c/README.md "$SDK_DIR/"
cp sdk/c/examples/* "$SDK_DIR/examples/"
cp sdk/c/build/libtunnara.so sdk/c/build/libtunnara.a "$SDK_DIR/lib/"

(
  cd "$STAGING/source"
  zip -q -1 -r "$ARTIFACTS/${PREFIX}-source.zip" "$PREFIX"
  tar -czf "$ARTIFACTS/${PREFIX}-source.tar.gz" "$PREFIX"
)
(
  cd "$STAGING/github"
  zip -q -1 -r "$ARTIFACTS/${PREFIX}-github-ready.zip" "$GITHUB_PREFIX"
  cd "$GITHUB_PREFIX"
  git init -q -b main
  git config user.name 'Tunnara Release Bot'
  git config user.email 'release@tunnara.local'
  git config core.autocrlf false
  git add --all
  git commit -q -m "feat: publish Tunnara platform ${VERSION}"
  git tag -a "v${VERSION}" -m "Tunnara Platform ${VERSION}"
  git bundle create "$ARTIFACTS/${PREFIX}-git-repository.bundle" --all
)
(
  cd "$STAGING/complete"
  zip -q -1 -r "$ARTIFACTS/${PREFIX}-complete.zip" "$PREFIX"
)
(
  cd "$STAGING/web"
  zip -q -1 -r "$ARTIFACTS/${WEB_PREFIX}.zip" "$WEB_PREFIX"
)
(
  cd "$STAGING/runtime"
  zip -q -1 -r "$ARTIFACTS/${RUNTIME_PREFIX}.zip" "$RUNTIME_PREFIX"
  tar -czf "$ARTIFACTS/${RUNTIME_PREFIX}.tar.gz" "$RUNTIME_PREFIX"
)
(
  cd "$STAGING/sdk"
  zip -q -1 -r "$ARTIFACTS/${SDK_PREFIX}.zip" "$SDK_PREFIX"
)
(
  cd "$ARTIFACTS"
  sha256sum *.zip *.tar.gz *.bundle > SHA256SUMS.txt
)
printf 'Artefatos gerados em %s\n' "$ARTIFACTS"
