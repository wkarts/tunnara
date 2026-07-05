#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
VERSION="$(tr -d '\r\n' < "$REPO_ROOT/VERSION")"
OUT_DIR="${TUNNARA_ANDROID_OUTPUT_DIR:-$ROOT/dist}"

if [[ -x "$ROOT/gradlew" ]]; then
  GRADLE=("$ROOT/gradlew")
elif command -v gradle >/dev/null 2>&1; then
  GRADLE=(gradle -p "$ROOT")
else
  echo "Gradle não encontrado. Use o Gradle Wrapper ou instale Gradle 8.10.2+." >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

"${GRADLE[@]}" :app:clean :app:assembleDebug :app:assembleRelease :app:bundleRelease --stacktrace

DEBUG_APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
SIGNED_RELEASE_APK="$ROOT/app/build/outputs/apk/release/app-release.apk"
UNSIGNED_RELEASE_APK="$ROOT/app/build/outputs/apk/release/app-release-unsigned.apk"
RELEASE_AAB="$ROOT/app/build/outputs/bundle/release/app-release.aab"

[[ -f "$DEBUG_APK" ]] || { echo "APK debug não foi gerado." >&2; exit 1; }
[[ -f "$RELEASE_AAB" ]] || { echo "AAB release não foi gerado." >&2; exit 1; }

cp "$DEBUG_APK" "$OUT_DIR/Tunnara-Android-v${VERSION}-debug-installable.apk"

SIGNING_MODE="unsigned"
if [[ -f "$SIGNED_RELEASE_APK" ]]; then
  SIGNING_MODE="signed"
  cp "$SIGNED_RELEASE_APK" "$OUT_DIR/Tunnara-Android-v${VERSION}-release-signed.apk"
elif [[ -f "$UNSIGNED_RELEASE_APK" ]]; then
  cp "$UNSIGNED_RELEASE_APK" "$OUT_DIR/Tunnara-Android-v${VERSION}-release-unsigned.apk"
else
  echo "APK release não foi encontrado." >&2
  exit 1
fi

cp "$RELEASE_AAB" "$OUT_DIR/Tunnara-Android-v${VERSION}-release-${SIGNING_MODE}.aab"

cat > "$OUT_DIR/build-metadata.json" <<JSON
{
  "product": "Tunnara Mobile Android",
  "version": "$VERSION",
  "releaseSigning": "$SIGNING_MODE",
  "debugApkInstallable": true,
  "releaseApkInstallable": $([[ "$SIGNING_MODE" == "signed" ]] && echo true || echo false),
  "storePublicationExecuted": false
}
JSON

(
  cd "$OUT_DIR"
  sha256sum ./*.apk ./*.aab > SHA256SUMS.txt
)

printf 'Artefatos Android gerados em %s (%s).\n' "$OUT_DIR" "$SIGNING_MODE"
