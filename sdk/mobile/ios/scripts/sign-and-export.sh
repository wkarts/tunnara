#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
VERSION="$(tr -d '\r\n' < "$REPO_ROOT/VERSION")"
OUT_DIR="${TUNNARA_IOS_OUTPUT_DIR:-$ROOT/dist}"
ARCHIVE_PATH="$OUT_DIR/TunnaraMobile-v${VERSION}.xcarchive"
EXPORT_PATH="$OUT_DIR/signed-export"

required=(
  TUNNARA_APPLE_CERTIFICATE_P12
  TUNNARA_APPLE_CERTIFICATE_PASSWORD
  TUNNARA_APPLE_APP_PROFILE
  TUNNARA_APPLE_PACKET_TUNNEL_PROFILE
  TUNNARA_APPLE_TEAM_ID
)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "$name não configurada." >&2; exit 2; }
done

for file in "$TUNNARA_APPLE_CERTIFICATE_P12" "$TUNNARA_APPLE_APP_PROFILE" "$TUNNARA_APPLE_PACKET_TUNNEL_PROFILE"; do
  [[ -f "$file" ]] || { echo "Arquivo de assinatura não encontrado: $file" >&2; exit 2; }
done

TEMP_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
KEYCHAIN="$TEMP_BASE/tunnara-build-$(date +%s).keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -hex 24)"
PROFILE_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROFILE_DIR" "$EXPORT_PATH"

APP_PROFILE_INSTALLED=""
PACKET_PROFILE_INSTALLED=""
cleanup() {
  security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  [[ -z "$APP_PROFILE_INSTALLED" ]] || rm -f "$APP_PROFILE_INSTALLED"
  [[ -z "$PACKET_PROFILE_INSTALLED" ]] || rm -f "$PACKET_PROFILE_INSTALLED"
}
trap cleanup EXIT

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$TUNNARA_APPLE_CERTIFICATE_P12" -k "$KEYCHAIN" -P "$TUNNARA_APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')

decode_profile() {
  local source="$1"
  local prefix="$2"
  local plist uuid name destination
  plist="$(mktemp)"
  security cms -D -i "$source" > "$plist"
  uuid="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$plist")"
  name="$(/usr/libexec/PlistBuddy -c 'Print :Name' "$plist")"
  destination="$PROFILE_DIR/$uuid.mobileprovision"
  cp "$source" "$destination"
  rm -f "$plist"
  printf -v "${prefix}_UUID" '%s' "$uuid"
  printf -v "${prefix}_NAME" '%s' "$name"
  printf -v "${prefix}_PATH" '%s' "$destination"
}

decode_profile "$TUNNARA_APPLE_APP_PROFILE" APP_PROFILE
decode_profile "$TUNNARA_APPLE_PACKET_TUNNEL_PROFILE" PACKET_PROFILE
APP_PROFILE_INSTALLED="$APP_PROFILE_PATH"
PACKET_PROFILE_INSTALLED="$PACKET_PROFILE_PATH"

rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

xcodebuild archive \
  -project "$ROOT/TunnaraMobile.xcodeproj" \
  -scheme TunnaraMobile \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$TUNNARA_APPLE_TEAM_ID" \
  TUNNARA_APPLE_TEAM_ID="$TUNNARA_APPLE_TEAM_ID" \
  TUNNARA_APP_PROFILE_SPECIFIER="$APP_PROFILE_NAME" \
  TUNNARA_PACKET_PROFILE_SPECIFIER="$PACKET_PROFILE_NAME" \
  CODE_SIGN_STYLE=Manual \
  OTHER_CODE_SIGN_FLAGS="--keychain $KEYCHAIN" \
  clean archive

EXPORT_METHOD="${TUNNARA_IOS_EXPORT_METHOD:-development}"
EXPORT_PLIST="$OUT_DIR/ExportOptions.generated.plist"
cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>${EXPORT_METHOD}</string>
  <key>teamID</key><string>${TUNNARA_APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>manual</string>
  <key>stripSwiftSymbols</key><true/>
  <key>compileBitcode</key><false/>
  <key>provisioningProfiles</key>
  <dict>
    <key>br.com.wwsoftwares.tunnara.mobile</key><string>${APP_PROFILE_NAME}</string>
    <key>br.com.wwsoftwares.tunnara.mobile.packet-tunnel</key><string>${PACKET_PROFILE_NAME}</string>
  </dict>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates

IPA="$(find "$EXPORT_PATH" -maxdepth 1 -type f -name '*.ipa' -print -quit)"
[[ -n "$IPA" ]] || { echo "IPA assinado não foi exportado." >&2; exit 1; }
cp "$IPA" "$OUT_DIR/Tunnara-iOS-v${VERSION}-${EXPORT_METHOD}-signed.ipa"

echo "IPA assinado gerado: $OUT_DIR/Tunnara-iOS-v${VERSION}-${EXPORT_METHOD}-signed.ipa"
