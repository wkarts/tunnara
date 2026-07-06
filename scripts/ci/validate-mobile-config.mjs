import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const numericVersion = version.split('-')[0].split('.').map(Number);
if (numericVersion.length !== 3 || numericVersion.some((part) => !Number.isInteger(part))) {
  throw new Error(`Versão SemVer inválida para validação mobile: ${version}`);
}
const mobileBuildNumber = String(
  numericVersion[0] * 10000 + numericVersion[1] * 100 + numericVersion[2]
);
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const required = [
  'sdk/mobile/android/build.gradle.kts',
  'sdk/mobile/android/settings.gradle.kts',
  'sdk/mobile/android/app/build.gradle.kts',
  'sdk/mobile/android/scripts/build-artifacts.sh',
  'sdk/mobile/ios/project.yml',
  'sdk/mobile/ios/TunnaraPacketTunnel/PacketTunnelProvider.swift',
  'sdk/mobile/ios/TunnaraPacketTunnel/WgQuickConfigParser.swift',
  'sdk/mobile/ios/scripts/build-artifacts.sh',
  'sdk/mobile/ios/scripts/prepare-wireguard-kit.sh',
  'sdk/mobile/ios/scripts/sign-and-export.sh',
  '.github/workflows/mobile.yml',
  '.github/workflows/mobile-release.yml',
  '.github/dependabot.yml',
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`Arquivo mobile obrigatório ausente: ${relative}`);
  }
}

const androidApp = read('sdk/mobile/android/app/build.gradle.kts');
const androidRoot = read('sdk/mobile/android/build.gradle.kts');
const androidScript = read('sdk/mobile/android/scripts/build-artifacts.sh');
const iosProject = read('sdk/mobile/ios/project.yml');
const iosPacketTunnel = read('sdk/mobile/ios/TunnaraPacketTunnel/PacketTunnelProvider.swift');
const iosWgQuickParser = read('sdk/mobile/ios/TunnaraPacketTunnel/WgQuickConfigParser.swift');
const iosBuild = read('sdk/mobile/ios/scripts/build-artifacts.sh');
const iosPrepare = read('sdk/mobile/ios/scripts/prepare-wireguard-kit.sh');
const mobileChecks = read('.github/workflows/mobile.yml');
const mobileRelease = read('.github/workflows/mobile-release.yml');
const dependabot = read('.github/dependabot.yml');

if (!androidApp.includes(`versionName = "${version}"`)) {
  throw new Error(`Android versionName não está sincronizado com ${version}.`);
}
if (!iosProject.includes(`MARKETING_VERSION: ${version}`)) {
  throw new Error(`iOS MARKETING_VERSION não está sincronizado com ${version}.`);
}

const agp = androidRoot.match(/com\.android\.application"\) version "([^"]+)"/)?.[1];
const gradle = mobileRelease.match(/gradle-version:\s*['"]?([^'"\s]+)['"]?/)?.[1];
if (!agp || !gradle) {
  throw new Error('Não foi possível determinar as versões do Android Gradle Plugin e do Gradle do workflow.');
}
if (/^9\.2\./.test(agp) && !/^9\.4\./.test(gradle)) {
  throw new Error(`AGP ${agp} exige Gradle 9.4.x; o workflow usa ${gradle}.`);
}
if (!androidScript.includes(`Gradle ${gradle}+`)) {
  throw new Error(`Mensagem do build Android não está sincronizada com Gradle ${gradle}.`);
}
if (/org\.jetbrains\.kotlin\.android/.test(androidRoot) || /org\.jetbrains\.kotlin\.android/.test(androidApp)) {
  throw new Error('AGP 9 usa Kotlin integrado; remova o plugin org.jetbrains.kotlin.android.');
}
if (!androidApp.includes('kotlin {') || !androidApp.includes('JvmTarget.JVM_17')) {
  throw new Error('Android deve configurar o compilador Kotlin integrado para JVM 17.');
}
if (!androidApp.includes('implementation("androidx.core:core-ktx:1.16.0")')) {
  throw new Error('AndroidX Core deve permanecer em 1.16.0 enquanto compileSdk estiver em API 35.');
}
for (const dependency of ['androidx.core:core', 'androidx.core:core-ktx']) {
  const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(
    String.raw`dependency-name:\s*"${escaped}"[\s\S]*?versions:\s*\[">=1\.17\.0"\]`
  );
  if (!rule.test(dependabot)) {
    throw new Error(`Dependabot deve bloquear ${dependency} >=1.17.0 enquanto compileSdk for 35.`);
  }
}

if (iosPacketTunnel.includes('TunnelConfiguration(fromWgQuickConfig:')) {
  throw new Error(
    'PacketTunnelProvider não pode chamar fromWgQuickConfig diretamente: ' +
    'esse initializer não é exportado pelo produto Swift Package WireGuardKit.'
  );
}
if (!iosPacketTunnel.includes('WgQuickConfigParser.parse(raw, name: "Tunnara")')) {
  throw new Error('PacketTunnelProvider deve usar o parser wg-quick local validado.');
}
for (const expected of [
  'import WireGuardKit',
  'enum WgQuickConfigParser',
  'static func parse(_ source: String, name: String? = nil) throws -> TunnelConfiguration',
  'InterfaceConfiguration(privateKey: privateKey)',
  'PeerConfiguration(publicKey: publicKey)',
  'TunnelConfiguration(',
  'name: name',
  'interface: interfaceConfiguration',
  'peers: peers',
]) {
  if (!iosWgQuickParser.includes(expected)) {
    throw new Error(`Parser wg-quick local incompleto: ${expected}`);
  }
}

const iosAppTarget = iosProject.match(
  /\n  TunnaraMobile:\n([\s\S]*?)(?=\n  TunnaraPacketTunnel:\n)/
)?.[1];
if (!iosAppTarget) {
  throw new Error('Não foi possível localizar o target TunnaraMobile no project.yml.');
}
if (!/GENERATE_INFOPLIST_FILE:\s*(?:YES|true)/.test(iosAppTarget)) {
  throw new Error(
    'O target TunnaraMobile deve gerar o Info.plist do bundle principal ' +
    '(GENERATE_INFOPLIST_FILE: YES).'
  );
}
for (const expected of [
  'INFOPLIST_KEY_CFBundleDisplayName: Tunnara',
  `INFOPLIST_KEY_CFBundleShortVersionString: ${version}`,
  `INFOPLIST_KEY_CFBundleVersion: ${mobileBuildNumber}`,
]) {
  if (!iosAppTarget.includes(expected)) {
    throw new Error(`Configuração do Info.plist gerado do aplicativo ausente: ${expected}`);
  }
}

if (!iosProject.includes('path: .wireguard-apple')) {
  throw new Error('WireGuardKit deve usar o checkout local determinístico .wireguard-apple.');
}
if (!iosBuild.includes('prepare-wireguard-kit.sh')) {
  throw new Error('Build iOS deve preparar WireGuardKit antes de gerar o projeto Xcode.');
}
if (!iosPrepare.includes('swift-tools-version:5.5')) {
  throw new Error('Preparação do WireGuardKit deve corrigir o PackageDescription para Swift Tools 5.5.');
}
for (const expected of [
  '#include <stdint.h>',
  "('u_int32_t', 'uint32_t')",
  "('u_int16_t', 'uint16_t')",
  "('u_char', 'uint8_t')",
  'GOOS_iphonesimulator := ios',
]) {
  if (!iosPrepare.includes(expected)) {
    throw new Error(`Preparação do WireGuardKit não contém a correção Xcode/iOS Simulator: ${expected}`);
  }
}
for (const expected of [
  'WireGuardGoBridgeiOS:',
  'platform: iOS',
  'toolPath: /usr/bin/make',
  'workingDirectory: .wireguard-apple/Sources/WireGuardKitGo',
  'passSettings: true',
  '- target: WireGuardGoBridgeiOS',
]) {
  if (!iosProject.includes(expected)) {
    throw new Error(`project.yml não integra o bridge WireGuardGo via target legado: ${expected}`);
  }
}


if (!mobileRelease.includes("go-version: '1.19.x'")) {
  throw new Error('mobile-release.yml deve fixar Go 1.19.x para o WireGuardGo bridge legado.');
}
for (const [name, content] of [
  ['mobile.yml', mobileChecks],
  ['build-artifacts.sh', iosBuild],
]) {
  for (const expected of ['ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES']) {
    if (!content.includes(expected)) {
      throw new Error(`${name} deve limitar o build de iOS Simulator a arm64: ${expected}`);
    }
  }
}

for (const expected of [
  "gradle-version: '9.4.1'",
  ':app:assembleDebug',
  'xcodebuild -resolvePackageDependencies',
  "go-version: '1.19.x'",
  'Compile iOS simulator application',
  'Validate generated iOS application Info.plist settings',
  'GENERATE_INFOPLIST_FILE = YES',
  'prepare-wireguard-kit.sh',
]) {
  if (!mobileChecks.includes(expected)) {
    throw new Error(`mobile.yml não contém a validação obrigatória: ${expected}`);
  }
}

console.log(
  `MOBILE_CONFIG_OK versão ${version}; AGP ${agp}/Gradle ${gradle}, ` +
  'Android e iOS compile smoke, com resolução WireGuardKit, habilitados.'
);
