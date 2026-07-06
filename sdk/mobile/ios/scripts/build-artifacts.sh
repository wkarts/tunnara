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
command -v python3 >/dev/null 2>&1 || { echo "python3 não encontrado." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git não encontrado." >&2; exit 1; }
command -v make >/dev/null 2>&1 || { echo "make não encontrado." >&2; exit 1; }
command -v go >/dev/null 2>&1 || { echo "Go não encontrado; WireGuardGoBridgeiOS exige Go." >&2; exit 1; }

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$UNSIGNED_BUILD" "$SIMULATOR_BUILD" "$SOURCE_PACKAGES"

# O pacote remoto 1.0.16-27 declara swift-tools-version 5.3, mas usa APIs de
# PackageDescription 5.5. Ele precisa ser preparado antes de o XcodeGen gerar
# o projeto e antes de o SwiftPM tentar interpretar o manifesto.
bash "$ROOT/scripts/prepare-wireguard-kit.sh"
WIREGUARD_CHECKOUT="$ROOT/.wireguard-apple"
[[ -f "$WIREGUARD_CHECKOUT/Package.swift" ]] || {
  echo "Checkout WireGuardKit local não foi preparado em $WIREGUARD_CHECKOUT." >&2
  exit 1
}

grep -Eq '^//[[:space:]]*swift-tools-version:5\.(9|[1-9][0-9])' "$WIREGUARD_CHECKOUT/Package.swift" || {
  echo "Package.swift do WireGuardKit não foi atualizado para Swift Tools 5.9+." >&2
  exit 1
}

(
  cd "$ROOT"
  xcodegen generate
)

xcodebuild -resolvePackageDependencies \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -clonedSourcePackagesDirPath "$SOURCE_PACKAGES"

BUILD_SETTINGS="$(xcodebuild \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -target TunnaraMobile \
  -configuration Debug \
  -sdk iphonesimulator \
  -clonedSourcePackagesDirPath "$SOURCE_PACKAGES" \
  -showBuildSettings)"
grep -Eq 'GENERATE_INFOPLIST_FILE = YES' <<<"$BUILD_SETTINGS" || {
  echo 'TunnaraMobile deve usar GENERATE_INFOPLIST_FILE = YES.' >&2
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
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$SIMULATOR_APP" "$OUT_DIR/Tunnara-iOS-v${VERSION}-simulator-app.zip"

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
[[ -f "$UNSIGNED_APP/Info.plist" ]] || { echo "TunnaraMobile.app foi gerado sem Info.plist." >&2; exit 1; }

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
  "simulatorAppGenerated": true,
  "signedIpaGenerated": $SIGNING_READY,
  "storePublicationExecuted": false
}
JSON

(
  cd "$OUT_DIR"
  : > SHA256SUMS-ios.txt
  while IFS= read -r artifact; do
    shasum -a 256 "$artifact" >> SHA256SUMS-ios.txt
  done < <(find . -maxdepth 1 -type f \( -name '*.ipa' -o -name '*.zip' \) -print | LC_ALL=C sort)
)

echo "Artefatos iOS gerados em $OUT_DIR."
