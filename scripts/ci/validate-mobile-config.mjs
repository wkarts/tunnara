import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const version = read('VERSION').trim();
const [baseVersion, prerelease = ''] = version.split('-', 2);
const [major, minor, patch] = baseVersion.split('.').map(Number);
const baseBuild = major * 10000 + minor * 100 + patch;
const numericSuffix = Number(prerelease.toLowerCase().match(/(?:^|[.-])(\d+)(?:$|[.-])/)?.[1] ?? 0);
const stage = !prerelease ? 999 : prerelease.toLowerCase().startsWith('alpha') ? 100 : prerelease.toLowerCase().startsWith('beta') ? 500 : prerelease.toLowerCase().startsWith('rc') ? 900 : 50;
const buildNumber = String(baseBuild * 1000 + stage + Math.min(numericSuffix, 99));

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
  'scripts/ci/base64-decode.sh',
];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Arquivo mobile obrigatório ausente: ${relative}`);
}

const androidRoot = read('sdk/mobile/android/build.gradle.kts');
const android = read('sdk/mobile/android/app/build.gradle.kts');
const ios = read('sdk/mobile/ios/project.yml');
const provider = read('sdk/mobile/ios/TunnaraPacketTunnel/PacketTunnelProvider.swift');
const parser = read('sdk/mobile/ios/TunnaraPacketTunnel/WgQuickConfigParser.swift');
const iosBuild = read('sdk/mobile/ios/scripts/build-artifacts.sh');
const iosPatch = read('sdk/mobile/ios/scripts/prepare-wireguard-kit.sh');
const androidBuild = read('sdk/mobile/android/scripts/build-artifacts.sh');

const expect = (condition, message) => { if (!condition) throw new Error(message); };
expect(android.includes(`versionName = "${version}"`), `Android versionName não está sincronizado com ${version}.`);
expect(android.includes(`versionCode = ${buildNumber}`), `Android versionCode deve ser ${buildNumber}.`);
expect(!androidRoot.includes('org.jetbrains.kotlin.android') && !android.includes('org.jetbrains.kotlin.android'), 'AGP 9 usa Kotlin integrado; remova org.jetbrains.kotlin.android.');
expect(android.includes('compilerOptions') && android.includes('JvmTarget.JVM_17'), 'Android deve configurar Kotlin compilerOptions/JVM 17.');
expect(android.includes('androidx.core:core-ktx:1.16.0'), 'AndroidX Core deve permanecer em 1.16.0 enquanto compileSdk for 35.');
expect(android.includes('compileSdk = 35') && android.includes('targetSdk = 35'), 'compileSdk/targetSdk devem estar coordenados em 35 nesta série.');
expect(androidBuild.includes('build-metadata-android.json') && androidBuild.includes('SHA256SUMS-android.txt'), 'Assets Android devem possuir nomes exclusivos.');

expect(ios.includes(`MARKETING_VERSION: ${baseVersion}`), `iOS MARKETING_VERSION deve ser ${baseVersion}.`);
expect(ios.includes(`INFOPLIST_KEY_CFBundleShortVersionString: ${baseVersion}`), `iOS short version deve ser ${baseVersion}.`);
expect(ios.includes(`CURRENT_PROJECT_VERSION: ${buildNumber}`), `iOS CURRENT_PROJECT_VERSION deve ser ${buildNumber}.`);
expect(ios.includes(`INFOPLIST_KEY_CFBundleVersion: ${buildNumber}`), `iOS CFBundleVersion deve ser ${buildNumber}.`);
const mainTarget = ios.match(/  TunnaraMobile:\n[\s\S]*?(?=\n  TunnaraPacketTunnel:)/)?.[0] ?? '';
expect(mainTarget.includes('platform: iOS'), 'Target TunnaraMobile deve declarar platform iOS.');
expect(mainTarget.includes('GENERATE_INFOPLIST_FILE: YES'), 'Target TunnaraMobile deve gerar Info.plist.');
expect(provider.includes('WgQuickConfigParser.parse'), 'PacketTunnelProvider deve usar o parser wg-quick local.');
expect(!provider.includes('TunnelConfiguration(fromWgQuickConfig:'), 'Initializer privado fromWgQuickConfig não pode ser usado pelo pacote WireGuardKit.');
for (const symbol of ['PrivateKey(base64Key:', 'PublicKey(base64Key:', 'PreSharedKey(base64Key:', 'TunnelConfiguration(name:']) {
  expect(parser.includes(symbol), `Parser wg-quick não utiliza a API pública esperada: ${symbol}`);
}
expect(iosBuild.includes('ARCHS=arm64') && iosBuild.includes('ONLY_ACTIVE_ARCH=YES'), 'Smoke build iOS Simulator deve usar arm64 no runner Apple Silicon.');
expect(iosBuild.includes('GENERATE_INFOPLIST_FILE = YES'), 'Build iOS deve validar o Info.plist antes da compilação.');
expect(iosBuild.includes('shasum -a 256') && !iosBuild.includes('sha256sum'), 'Checksums iOS devem usar shasum compatível com macOS.');
expect(iosBuild.includes('build-metadata-ios.json') && iosBuild.includes('SHA256SUMS-ios.txt'), 'Assets iOS devem possuir nomes exclusivos.');
for (const token of ['u_int32_t', 'u_int16_t', 'u_char', 'GOOS_iphonesimulator']) {
  expect(iosPatch.includes(token), `Patch WireGuardKit não trata ${token}.`);
}

console.log(`MOBILE_CONFIG_OK versão ${version}; build ${buildNumber}; Android AGP 9 e iOS/Xcode 16 protegidos sem gerar artefatos.`);
