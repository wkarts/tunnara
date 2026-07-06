#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
VERSION="$(tr -d '\r\n' < "$REPO_ROOT/VERSION")"
OUT_DIR="${TUNNARA_IOS_OUTPUT_DIR:-$ROOT/dist}"
DERIVED_DATA="$OUT_DIR/DerivedData"
UNSIGNED_BUILD="$OUT_DIR/device-unsigned"
SIMULATOR_BUILD="$OUT_DIR/simulator"

command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild não encontrado; execute em macOS com Xcode." >&2; exit 1; }
command -v xcodegen >/dev/null 2>&1 || { echo "xcodegen não encontrado; instale com brew install xcodegen." >&2; exit 1; }

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$UNSIGNED_BUILD" "$SIMULATOR_BUILD"

"$ROOT/scripts/prepare-wireguard-kit.sh"

(
  cd "$ROOT"
  xcodegen generate
)

xcodebuild -resolvePackageDependencies \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile

xcodebuild \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED_DATA/simulator" \
  CONFIGURATION_BUILD_DIR="$SIMULATOR_BUILD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build

SIMULATOR_APP="$(find "$SIMULATOR_BUILD" -maxdepth 2 -type d -name 'TunnaraMobile.app' -print -quit)"
[[ -n "$SIMULATOR_APP" ]] || { echo "Aplicativo de simulador não foi gerado." >&2; exit 1; }
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$SIMULATOR_APP" "$OUT_DIR/Tunnara-iOS-v${VERSION}-simulator-app.zip"

xcodebuild \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA/device" \
  CONFIGURATION_BUILD_DIR="$UNSIGNED_BUILD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build

UNSIGNED_APP="$(find "$UNSIGNED_BUILD" -maxdepth 2 -type d -name 'TunnaraMobile.app' -print -quit)"
[[ -n "$UNSIGNED_APP" ]] || { echo "Aplicativo iOS device sem assinatura não foi gerado." >&2; exit 1; }

PAYLOAD_ROOT="$(mktemp -d)"
mkdir -p "$PAYLOAD_ROOT/Payload"
cp -R "$UNSIGNED_APP" "$PAYLOAD_ROOT/Payload/"
(
  cd "$PAYLOAD_ROOT"
  /usr/bin/zip -qry "$OUT_DIR/Tunnara-iOS-v${VERSION}-unsigned.ipa" Payload
)
rm -rf "$PAYLOAD_ROOT"

SIGNING_READY=false
for name in \
  TUNNARA_APPLE_CERTIFICATE_P12 \
  TUNNARA_APPLE_CERTIFICATE_PASSWORD \
  TUNNARA_APPLE_APP_PROFILE \
  TUNNARA_APPLE_PACKET_TUNNEL_PROFILE \
  TUNNARA_APPLE_TEAM_ID; do
  if [[ -z "${!name:-}" ]]; then
    SIGNING_READY=false
    break
  fi
  SIGNING_READY=true
done

if [[ "$SIGNING_READY" == true ]]; then
  TUNNARA_IOS_OUTPUT_DIR="$OUT_DIR" "$ROOT/scripts/sign-and-export.sh"
else
  echo "Credenciais Apple ausentes ou incompletas: IPA assinado será ignorado, sem falhar o build."
fi

cat > "$OUT_DIR/build-metadata.json" <<JSON
{
  "product": "Tunnara Mobile iOS",
  "version": "$VERSION",
  "unsignedIpaGenerated": true,
  "unsignedIpaInstallableOnStockDevices": false,
  "simulatorAppGenerated": true,
  "signedIpaGenerated": $SIGNING_READY,
  "storePublicationExecuted": false
}
JSON

(
  cd "$OUT_DIR"
  find . -maxdepth 1 -type f \( -name '*.ipa' -o -name '*.zip' \) -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt
)

echo "Artefatos iOS gerados em $OUT_DIR."
