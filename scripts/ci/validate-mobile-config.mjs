import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const required = [
  'sdk/mobile/android/build.gradle.kts',
  'sdk/mobile/android/settings.gradle.kts',
  'sdk/mobile/android/app/build.gradle.kts',
  'sdk/mobile/android/scripts/build-artifacts.sh',
  'sdk/mobile/ios/project.yml',
  'sdk/mobile/ios/scripts/build-artifacts.sh',
  'sdk/mobile/ios/scripts/sign-and-export.sh',
];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`Arquivo mobile obrigatório ausente: ${relative}`);
  }
}
const android = fs.readFileSync(path.join(root, 'sdk/mobile/android/app/build.gradle.kts'), 'utf8');
const ios = fs.readFileSync(path.join(root, 'sdk/mobile/ios/project.yml'), 'utf8');
if (!android.includes(`versionName = "${version}"`)) {
  throw new Error(`Android versionName não está sincronizado com ${version}.`);
}
if (!ios.includes(`MARKETING_VERSION: ${version}`)) {
  throw new Error(`iOS MARKETING_VERSION não está sincronizado com ${version}.`);
}
console.log(`MOBILE_CONFIG_OK versão ${version}; validação rápida sem gerar artefatos.`);
