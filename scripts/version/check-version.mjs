import fs from 'node:fs';

const expected = fs.readFileSync('VERSION', 'utf8').trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
function extract(file, pattern, label) {
  const match = fs.readFileSync(file, 'utf8').match(pattern);
  if (!match) throw new Error(`Não foi possível localizar ${label} em ${file}`);
  return match[1];
}

const values = [
  ['package.json', readJson('package.json').version],
  ['package-lock.json', readJson('package-lock.json').version],
  ['runtime/node/package.json', readJson('runtime/node/package.json').version],
  ['runtime/node/lib/utils.mjs', extract('runtime/node/lib/utils.mjs', /export const VERSION = '([^']+)'/, 'runtime VERSION')],
  ['apps/console/package.json', readJson('apps/console/package.json').version],
  ['apps/console/package-lock.json', readJson('apps/console/package-lock.json').version],
  ['apps/console/src-tauri/tauri.conf.json', readJson('apps/console/src-tauri/tauri.conf.json').version],
  ['apps/console/src/assets/branding/brand.json', readJson('apps/console/src/assets/branding/brand.json').version],
  ['Cargo.toml', extract('Cargo.toml', /\[workspace\.package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/, 'workspace.package.version')],
  ['apps/console/src-tauri/Cargo.toml', extract('apps/console/src-tauri/Cargo.toml', /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/, 'package.version')],
  ['apps/console/src-tauri/generic-license-tauri/Cargo.toml', extract('apps/console/src-tauri/generic-license-tauri/Cargo.toml', /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/, 'package.version')],
  ['apps/console/src/config/projectConfig.ts', extract('apps/console/src/config/projectConfig.ts', /version:\s*"([^"]+)"/, 'projectConfig.version')],
  ['apps/control-api/.env.example', extract('apps/control-api/.env.example', /^APP_VERSION=(.+)$/m, 'APP_VERSION')],
  ['apps/control-api/config/app.php', extract('apps/control-api/config/app.php', /'version' => env\('APP_VERSION', '([^']+)'\)/, 'config.app.version')],
  ['apps/console/VERSION', fs.readFileSync('apps/console/VERSION', 'utf8').trim()],
  ['sdk/c/src/tunnara.c', extract('sdk/c/src/tunnara.c', /#define TUNNARA_VERSION "([^"]+)"/, 'TUNNARA_VERSION')],
  ['sdk/c/CMakeLists.txt', extract('sdk/c/CMakeLists.txt', /project\(tunnara_sdk_c VERSION ([^ )]+)/, 'CMake project version')],
  ['sdk/mobile/android/app/build.gradle.kts', extract('sdk/mobile/android/app/build.gradle.kts', /versionName = "([^"]+)"/, 'Android versionName')],
  ['sdk/mobile/ios/Config/PacketTunnel-Info.plist', extract('sdk/mobile/ios/Config/PacketTunnel-Info.plist', /<key>CFBundleShortVersionString<\/key><string>([^<]+)<\/string>/, 'iOS bundle version')],
  ['sdk/mobile/ios/project.yml (marketing)', extract('sdk/mobile/ios/project.yml', /MARKETING_VERSION: ([^\n]+)/, 'iOS marketing version')],
  ['sdk/mobile/ios/project.yml (short)', extract('sdk/mobile/ios/project.yml', /INFOPLIST_KEY_CFBundleShortVersionString: ([^\n]+)/, 'iOS short version')],
];

let failed = false;
for (const [file, value] of values) {
  if (value !== expected) { console.error(`${file}: ${value} != ${expected}`); failed = true; }
}
const numericVersion = expected.split('-')[0].split('.').map(Number);
const expectedBuild = String(numericVersion[0] * 10000 + numericVersion[1] * 100 + numericVersion[2]);
const buildValues = [
  ['Android versionCode', extract('sdk/mobile/android/app/build.gradle.kts', /versionCode = (\d+)/, 'Android versionCode')],
  ['iOS extension CFBundleVersion', extract('sdk/mobile/ios/Config/PacketTunnel-Info.plist', /<key>CFBundleVersion<\/key><string>([^<]+)<\/string>/, 'iOS build')],
  ['iOS project CURRENT_PROJECT_VERSION', extract('sdk/mobile/ios/project.yml', /CURRENT_PROJECT_VERSION: (\d+)/, 'iOS project build')],
];
for (const [label, value] of buildValues) {
  if (value !== expectedBuild) { console.error(`${label}: ${value} != ${expectedBuild}`); failed = true; }
}
if (failed) process.exit(1);
console.log(`Versão sincronizada em ${values.length} pontos e build mobile ${expectedBuild}: ${expected}`);
