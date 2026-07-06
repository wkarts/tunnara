import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { baseVersion, mobileBuildNumber } from '../version/version-utils.mjs';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const version = read('VERSION').trim();
const required = [
  'sdk/mobile/android/build.gradle.kts',
  'sdk/mobile/android/settings.gradle.kts',
  'sdk/mobile/android/app/build.gradle.kts',
  'sdk/mobile/android/scripts/build-artifacts.sh',
  'sdk/mobile/ios/project.yml',
  'sdk/mobile/ios/Config/PacketTunnel-Info.plist',
  'sdk/mobile/ios/scripts/build-artifacts.sh',
  'sdk/mobile/ios/scripts/prepare-wireguard-kit.sh',
  'sdk/mobile/ios/scripts/sign-and-export.sh',
];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`Arquivo mobile obrigatório ausente: ${relative}`);
  }
}

const androidRoot = read('sdk/mobile/android/build.gradle.kts');
const android = read('sdk/mobile/android/app/build.gradle.kts');
const androidBuild = read('sdk/mobile/android/scripts/build-artifacts.sh');
const ios = read('sdk/mobile/ios/project.yml');
const iosBuild = read('sdk/mobile/ios/scripts/build-artifacts.sh');
const wireGuardPrepare = read('sdk/mobile/ios/scripts/prepare-wireguard-kit.sh');
const extensionPlist = read('sdk/mobile/ios/Config/PacketTunnel-Info.plist');
const iosBaseVersion = baseVersion(version);
const expectedBuild = String(mobileBuildNumber(version));

for (const expected of [
  `versionName = "${version}"`,
  `versionCode = ${expectedBuild}`,
  'compileSdk = 35',
  'targetSdk = 35',
  'implementation("androidx.core:core-ktx:1.16.0")',
]) {
  if (!android.includes(expected)) {
    throw new Error(`Configuração Android ausente ou dessincronizada: ${expected}.`);
  }
}
if (/org\.jetbrains\.kotlin\.android|kotlinOptions\s*\{/.test(`${androidRoot}\n${android}`)) {
  throw new Error('Android AGP 9 deve usar Kotlin integrado, sem plugin org.jetbrains.kotlin.android ou kotlinOptions legado.');
}
if (!androidRoot.includes('id("com.android.application") version "9.2.1" apply false')) {
  throw new Error('Android Gradle Plugin 9.2.1 não está fixado no build raiz.');
}
if (!androidBuild.includes('build-metadata-android.json') || !androidBuild.includes('SHA256SUMS-android.txt')) {
  throw new Error('Artefatos Android devem usar metadados e checksums exclusivos.');
}

for (const expected of [
  `MARKETING_VERSION: ${iosBaseVersion}`,
  `INFOPLIST_KEY_CFBundleShortVersionString: ${iosBaseVersion}`,
  `INFOPLIST_KEY_CFBundleVersion: ${expectedBuild}`,
  `CURRENT_PROJECT_VERSION: ${expectedBuild}`,
  'GENERATE_INFOPLIST_FILE: YES',
]) {
  if (!ios.includes(expected)) {
    throw new Error(`Configuração iOS ausente ou dessincronizada: ${expected}.`);
  }
}
if (!extensionPlist.includes(`<key>CFBundleShortVersionString</key><string>${iosBaseVersion}</string>`)) {
  throw new Error(`CFBundleShortVersionString da extensão iOS não está sincronizado com ${iosBaseVersion}.`);
}
if (!extensionPlist.includes(`<key>CFBundleVersion</key><string>${expectedBuild}</string>`)) {
  throw new Error(`CFBundleVersion da extensão iOS não está sincronizado com ${expectedBuild}.`);
}
for (const expected of [
  'bash "$ROOT/scripts/prepare-wireguard-kit.sh" "$WIREGUARD_CHECKOUT"',
  'GENERATE_INFOPLIST_FILE = YES',
  'ARCHS=arm64',
  'ONLY_ACTIVE_ARCH=YES',
  'build-metadata-ios.json',
  'SHA256SUMS-ios.txt',
  'shasum -a 256',
]) {
  if (!iosBuild.includes(expected)) throw new Error(`Build iOS não contém a proteção obrigatória: ${expected}.`);
}
if (/sort\s+-z|xargs\s+-0/.test(iosBuild)) {
  throw new Error('Build iOS não pode depender de opções GNU indisponíveis no macOS padrão.');
}
for (const expected of ['#include <stdint.h>', "'u_int32_t': 'uint32_t'", "'u_char': 'uint8_t'"]) {
  if (!wireGuardPrepare.includes(expected)) throw new Error(`Preparação WireGuardKit incompleta: ${expected}.`);
}

console.log(
  `MOBILE_CONFIG_OK versão ${version}; iOS ${iosBaseVersion}; build ${expectedBuild}; AGP 9/Kotlin integrado e assets exclusivos validados sem gerar artefatos.`,
);
