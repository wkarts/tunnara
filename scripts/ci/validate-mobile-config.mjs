import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const required = [
  'sdk/mobile/android/build.gradle.kts',
  'sdk/mobile/android/settings.gradle.kts',
  'sdk/mobile/android/app/build.gradle.kts',
  'sdk/mobile/android/scripts/build-artifacts.sh',
  'sdk/mobile/ios/project.yml',
  'sdk/mobile/ios/scripts/build-artifacts.sh',
  'sdk/mobile/ios/scripts/prepare-wireguard-kit.sh',
  'sdk/mobile/ios/scripts/sign-and-export.sh',
  '.github/workflows/mobile.yml',
  '.github/workflows/mobile-release.yml',
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
const iosBuild = read('sdk/mobile/ios/scripts/build-artifacts.sh');
const iosPrepare = read('sdk/mobile/ios/scripts/prepare-wireguard-kit.sh');
const mobileChecks = read('.github/workflows/mobile.yml');
const mobileRelease = read('.github/workflows/mobile-release.yml');

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
  'WireGuardGoBridgeiOS:',
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

for (const expected of [
  "gradle-version: '9.4.1'",
  ':app:assembleDebug',
  'xcodebuild -resolvePackageDependencies',
  "go-version: '1.19.x'",
  'Compile iOS simulator application',
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
