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
DOCKER_PREFIX="Tunnara-Docker-v${VERSION}"
ARTIFACTS="$ROOT_DIR/artifacts"
STAGING="$(mktemp -d)"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

rm -rf "$ARTIFACTS"
mkdir -p "$ARTIFACTS"

[[ -f apps/console/dist/index.html ]] || { echo 'Execute npm run console:build antes de empacotar.' >&2; exit 1; }
[[ -x dist/tunnara-agent-linux-x64 && -x dist/tunnara-server-linux-x64 ]] || { echo 'Gere os executáveis SEA Linux antes de empacotar.' >&2; exit 1; }
[[ -f sdk/c/build/libtunnara.so && -f sdk/c/build/libtunnara.a ]] || { echo 'Execute npm run sdk:c:build antes de empacotar.' >&2; exit 1; }
node scripts/github/validate-repository.mjs

copy_source() {
  local destination="$1"
  mkdir -p "$destination"
  tar \
    --exclude='.git' \
    --exclude='artifacts' \
    --exclude='node_modules' \
    --exclude='*/node_modules' \
    --exclude='vendor' \
    --exclude='*/vendor' \
    --exclude='target' \
    --exclude='*/target' \
    --exclude='.build' \
    --exclude='*/.build' \
    --exclude='dist' \
    --exclude='*/dist' \
    --exclude='sdk/c/build' \
    --exclude='sdk/mobile/android/.gradle' \
    --exclude='sdk/mobile/android/app/build' \
    --exclude='sdk/mobile/ios/TunnaraMobile.xcodeproj' \
    --exclude='.env' \
    --exclude='*/.env' \
    --exclude='data' \
    --exclude='*/data' \
    --exclude='backups' \
    --exclude='*/backups' \
    --exclude='*.sqlite' \
    --exclude='*.sqlite-wal' \
    --exclude='*.sqlite-shm' \
    --exclude='CMakeCache.txt' \
    --exclude='CMakeFiles' \
    -cf - . | tar -C "$destination" -xf -
}

SOURCE_DIR="$STAGING/source/$PREFIX"
GITHUB_DIR="$STAGING/github/$GITHUB_PREFIX"
COMPLETE_DIR="$STAGING/complete/$PREFIX"
WEB_DIR="$STAGING/web/$WEB_PREFIX"
RUNTIME_DIR="$STAGING/runtime/$RUNTIME_PREFIX"
SDK_DIR="$STAGING/sdk/$SDK_PREFIX"
DOCKER_DIR="$STAGING/docker/$DOCKER_PREFIX"

copy_source "$SOURCE_DIR"
copy_source "$GITHUB_DIR"
copy_source "$COMPLETE_DIR"
mkdir -p \
  "$WEB_DIR" \
  "$RUNTIME_DIR/bin" "$RUNTIME_DIR/install" \
  "$SDK_DIR/include" "$SDK_DIR/lib" "$SDK_DIR/examples" \
  "$DOCKER_DIR" \
  "$COMPLETE_DIR/prebuilt/console-web" \
  "$COMPLETE_DIR/prebuilt/runtime/linux-x64" \
  "$COMPLETE_DIR/prebuilt/sdk-c/linux-x64/include" \
  "$COMPLETE_DIR/prebuilt/sdk-c/linux-x64/lib"

cp -a apps/console/dist/. "$WEB_DIR/"
cp -a apps/console/dist/. "$COMPLETE_DIR/prebuilt/console-web/"
cp dist/tunnara-agent-linux-x64 "$RUNTIME_DIR/bin/tunnara"
cp dist/tunnara-server-linux-x64 "$RUNTIME_DIR/bin/tunnara-server"
cp dist/tunnara-agent-linux-x64 "$COMPLETE_DIR/prebuilt/runtime/linux-x64/tunnara"
cp dist/tunnara-server-linux-x64 "$COMPLETE_DIR/prebuilt/runtime/linux-x64/tunnara-server"
cp -a deploy/standalone/linux/. "$RUNTIME_DIR/install/"
cp README.md VERSION LICENSE LICENSE-NOTICE.md SECURITY.md "$RUNTIME_DIR/"
cp sdk/c/include/tunnara.h "$SDK_DIR/include/"
cp sdk/c/README.md "$SDK_DIR/"
cp sdk/c/examples/* "$SDK_DIR/examples/"
cp sdk/c/build/libtunnara.so sdk/c/build/libtunnara.a "$SDK_DIR/lib/"
cp sdk/c/include/tunnara.h "$COMPLETE_DIR/prebuilt/sdk-c/linux-x64/include/"
cp sdk/c/build/libtunnara.so sdk/c/build/libtunnara.a "$COMPLETE_DIR/prebuilt/sdk-c/linux-x64/lib/"

mkdir -p "$DOCKER_DIR/deploy" "$DOCKER_DIR/docs/operations"
cp -a deploy/docker "$DOCKER_DIR/deploy/"
cp docker.sh README.md LICENSE LICENSE-NOTICE.md SECURITY.md VERSION "$DOCKER_DIR/"
cp \
  docs/operations/QUICKSTART.md \
  docs/operations/DOCKER_DEPLOYMENT.md \
  docs/operations/PRODUCTION.md \
  docs/operations/STORAGE_PROVIDERS.md \
  "$DOCKER_DIR/docs/operations/"

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
  cd "$STAGING/docker"
  zip -q -1 -r "$ARTIFACTS/${DOCKER_PREFIX}.zip" "$DOCKER_PREFIX"
)
node - "$ARTIFACTS" "$VERSION" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [dir, version] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((name) => name !== 'release-manifest.json').sort();
fs.writeFileSync(path.join(dir, 'release-manifest.json'), JSON.stringify({
  product: 'Tunnara Platform',
  version,
  generatedAt: new Date().toISOString(),
  files,
}, null, 2) + '\n');
NODE
(
  cd "$ARTIFACTS"
  sha256sum *.zip *.tar.gz *.bundle release-manifest.json > SHA256SUMS-core.txt
)
printf 'Artefatos gerados em %s\n' "$ARTIFACTS"
