import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];

const rootCargo = read('Cargo.toml');
if (!/reqwest\s*=\s*\{[^\n]*version\s*=\s*"0\.13"[^\n]*features\s*=\s*\[[^\]]*"rustls"/m.test(rootCargo)) {
  errors.push('Cargo.toml: reqwest 0.13 deve usar a feature rustls.');
}
if (/reqwest\s*=\s*\{[^\n]*version\s*=\s*"0\.13"[^\n]*rustls-tls/m.test(rootCargo)) {
  errors.push('Cargo.toml: rustls-tls foi removida no reqwest 0.13.');
}

const tauriCargo = read('apps/console/src-tauri/Cargo.toml');
for (const [name, version] of [
  ['rand', '0.8.5'],
  ['sha2', '0.10.9'],
  ['hmac', '0.12.1'],
  ['sha1', '0.10.6'],
]) {
  const expression = new RegExp(`^${name}\\s*=\\s*"${version.replaceAll('.', '\\.') }"\\s*$`, 'm');
  if (!expression.test(tauriCargo)) errors.push(`Console Tauri: ${name} deve permanecer fixado em ${version}.`);
}

const dockerWorkflow = read('.github/workflows/docker-publish.yml');
for (const expected of [
  'docker/setup-buildx-action@v4',
  'docker/metadata-action@v6',
  'docker/build-push-action@v7',
]) {
  if (!dockerWorkflow.includes(expected)) errors.push(`docker-publish.yml: action desatualizada ou ausente: ${expected}`);
}

const mobileWorkflow = read('.github/workflows/mobile-release.yml');
if (!mobileWorkflow.includes("gradle-version: '9.4.1'")) {
  errors.push('mobile-release.yml: AGP 9.2.1 exige Gradle 9.4.1.');
}
if (!mobileWorkflow.includes('actions/setup-go@v6') || !mobileWorkflow.includes("go-version: '1.24.x'")) {
  errors.push('mobile-release.yml: build WireGuardKit deve preparar uma toolchain Go explícita.');
}
const androidRoot = read('sdk/mobile/android/build.gradle.kts');
if (!androidRoot.includes('version "9.2.1"')) errors.push('Android: AGP 9.2.1 esperado.');

const iosProject = read('sdk/mobile/ios/project.yml');
for (const expected of [
  'path: .wireguard-apple',
  'WireGuardGoBridgeiOS:',
  'toolPath: /usr/bin/make',
  'workingDirectory: $(PROJECT_DIR)/.wireguard-apple/Sources/WireGuardKitGo',
  '- target: WireGuardGoBridgeiOS',
]) {
  if (!iosProject.includes(expected)) errors.push(`iOS project.yml: configuração ausente: ${expected}`);
}
if (/url:\s*https:\/\/git\.zx2c4\.com\/wireguard-apple/.test(iosProject)) {
  errors.push('iOS project.yml não deve resolver WireGuardKit remoto antes do patch de Package.swift.');
}

const prepare = read('sdk/mobile/ios/scripts/prepare-wireguard-kit.sh');
if (!prepare.includes("'// swift-tools-version:5.9'")) {
  errors.push('prepare-wireguard-kit.sh deve atualizar Package.swift para swift-tools-version 5.9.');
}
const iosBuild = read('sdk/mobile/ios/scripts/build-artifacts.sh');
const prepareIndex = iosBuild.indexOf('bash "$ROOT/scripts/prepare-wireguard-kit.sh"');
const xcodegenIndex = iosBuild.indexOf('xcodegen generate');
if (prepareIndex < 0 || xcodegenIndex < 0 || prepareIndex > xcodegenIndex) {
  errors.push('Build iOS deve preparar WireGuardKit antes de executar xcodegen.');
}
if (!iosBuild.includes('command -v go')) errors.push('Build iOS deve validar a presença de Go.');

if (errors.length) {
  console.error('NATIVE_DEPENDENCIES_INVALID');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('NATIVE_DEPENDENCIES_OK reqwest/Rust, Tauri crypto, Android Gradle e WireGuardKit iOS compatíveis.');
