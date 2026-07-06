#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
VERSION="$(tr -d '\r\n' < "$REPO_ROOT/VERSION")"
OUT_DIR="${TUNNARA_IOS_OUTPUT_DIR:-$ROOT/dist}"
DERIVED_DATA="$OUT_DIR/DerivedData"
SOURCE_PACKAGES="$OUT_DIR/SourcePackages"
UNSIGNED_BUILD="$OUT_DIR/device-unsigned"
SIMULATOR_BUILD="$OUT_DIR/simulator"

command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild não encontrado; execute em macOS com Xcode." >&2; exit 1; }
command -v xcodegen >/dev/null 2>&1 || { echo "xcodegen não encontrado; instale com brew install xcodegen." >&2; exit 1; }

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$UNSIGNED_BUILD" "$SIMULATOR_BUILD" "$SOURCE_PACKAGES"

(
  cd "$ROOT"
  xcodegen generate
)

xcodebuild -resolvePackageDependencies \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -derivedDataPath "$DERIVED_DATA/packages" \
  -clonedSourcePackagesDirPath "$SOURCE_PACKAGES"

WIREGUARD_SOURCE="$SOURCE_PACKAGES/checkouts/wireguard-apple"
[[ -d "$WIREGUARD_SOURCE" ]] || { echo "Checkout WireGuardKit não encontrado em $WIREGUARD_SOURCE." >&2; exit 1; }
bash "$ROOT/scripts/prepare-wireguard-kit.sh" "$WIREGUARD_SOURCE"

# Preflight: evita descobrir somente no ValidateEmbeddedBinary que o app não possui Info.plist.
settings="$(xcodebuild \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -target TunnaraMobile \
  -configuration Debug \
  -sdk iphonesimulator \
  -showBuildSettings)"
grep -Eq 'GENERATE_INFOPLIST_FILE = YES' <<<"$settings" || {
  echo "TunnaraMobile deve usar GENERATE_INFOPLIST_FILE = YES." >&2
  exit 1
}

xcodebuild \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED_DATA/simulator" \
  -clonedSourcePackagesDirPath "$SOURCE_PACKAGES" \
  CONFIGURATION_BUILD_DIR="$SIMULATOR_BUILD" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build

SIMULATOR_APP="$(find "$SIMULATOR_BUILD" -maxdepth 2 -type d -name 'TunnaraMobile.app' -print -quit)"
[[ -n "$SIMULATOR_APP" ]] || { echo "Aplicativo de simulador não foi gerado." >&2; exit 1; }
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$SIMULATOR_APP" "$OUT_DIR/Tunnara-iOS-v${VERSION}-simulator-arm64.zip"

xcodebuild \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA/device" \
  -clonedSourcePackagesDirPath "$SOURCE_PACKAGES" \
  CONFIGURATION_BUILD_DIR="$UNSIGNED_BUILD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  build

UNSIGNED_APP="$(find "$UNSIGNED_BUILD" -maxdepth 2 -type d -name 'TunnaraMobile.app' -print -quit)"
[[ -n "$UNSIGNED_APP" ]] || { echo "Aplicativo iOS device sem assinatura não foi gerado." >&2; exit 1; }

PAYLOAD_ROOT="$(mktemp -d)"
trap 'rm -rf "$PAYLOAD_ROOT"' EXIT
mkdir -p "$PAYLOAD_ROOT/Payload"
cp -R "$UNSIGNED_APP" "$PAYLOAD_ROOT/Payload/"
(
  cd "$PAYLOAD_ROOT"
  /usr/bin/zip -qry "$OUT_DIR/Tunnara-iOS-v${VERSION}-unsigned.ipa" Payload
)
rm -rf "$PAYLOAD_ROOT"
trap - EXIT

SIGNING_READY=true
for name in \
  TUNNARA_APPLE_CERTIFICATE_P12 \
  TUNNARA_APPLE_CERTIFICATE_PASSWORD \
  TUNNARA_APPLE_APP_PROFILE \
  TUNNARA_APPLE_PACKET_TUNNEL_PROFILE \
  TUNNARA_APPLE_TEAM_ID; do
  [[ -n "${!name:-}" ]] || SIGNING_READY=false
done

if [[ "$SIGNING_READY" == true ]]; then
  TUNNARA_IOS_OUTPUT_DIR="$OUT_DIR" bash "$ROOT/scripts/sign-and-export.sh"
else
  echo "Credenciais Apple ausentes ou incompletas: IPA assinado será ignorado, sem falhar o build."
fi

cat > "$OUT_DIR/build-metadata-ios.json" <<JSON
{
  "product": "Tunnara Mobile iOS",
  "version": "$VERSION",
  "unsignedIpaGenerated": true,
  "unsignedIpaInstallableOnStockDevices": false,
  "simulatorArm64Generated": true,
  "signedIpaGenerated": $SIGNING_READY,
  "storePublicationExecuted": false
}
JSON

(
  cd "$OUT_DIR"
  find . -maxdepth 1 -type f \( -name '*.ipa' -o -name '*.zip' -o -name 'build-metadata-ios.json' \) -print0 \
    | sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS-ios.txt
)

echo "Artefatos iOS gerados em $OUT_DIR."
