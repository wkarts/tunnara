import fs from 'node:fs';
import path from 'node:path';

const expected = fs.readFileSync('VERSION', 'utf8').trim();
const expectedBase = expected.split('-')[0];
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
function extract(file, pattern, label) {
  const match = fs.readFileSync(file, 'utf8').match(pattern);
  if (!match) throw new Error(`Não foi possível localizar ${label} em ${file}`);
  return match[1];
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
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
  ['sdk/c/CMakeLists.txt', extract('sdk/c/CMakeLists.txt', /project\(tunnara_sdk_c VERSION ([^ )]+)/, 'CMake project version'), expectedBase],
  ['sdk/mobile/android/app/build.gradle.kts', extract('sdk/mobile/android/app/build.gradle.kts', /versionName = "([^"]+)"/, 'Android versionName')],
  ['sdk/mobile/ios/Config/PacketTunnel-Info.plist', extract('sdk/mobile/ios/Config/PacketTunnel-Info.plist', /<key>CFBundleShortVersionString<\/key><string>([^<]+)<\/string>/, 'iOS bundle version'), expectedBase],
  ['sdk/mobile/ios/project.yml (marketing)', extract('sdk/mobile/ios/project.yml', /MARKETING_VERSION: ([^\n]+)/, 'iOS marketing version'), expectedBase],
  ['sdk/mobile/ios/project.yml (short)', extract('sdk/mobile/ios/project.yml', /INFOPLIST_KEY_CFBundleShortVersionString: ([^\n]+)/, 'iOS short version'), expectedBase],
  ['deploy/helm/tunnara/Chart.yaml', extract('deploy/helm/tunnara/Chart.yaml', /^version:\s*(.+)$/m, 'Helm chart version')],
  ['deploy/helm/tunnara/Chart appVersion', extract('deploy/helm/tunnara/Chart.yaml', /^appVersion:\s*\"?([^\"\n]+)\"?$/m, 'Helm appVersion')],
  ['deploy/docker/.env.example', extract('deploy/docker/.env.example', /^TUNNARA_VERSION=(.+)$/m, 'Docker version')],
  ['deploy/docker/storage/docker-compose.base.yml', extract('deploy/docker/storage/docker-compose.base.yml', /APP_VERSION:\s*([^\s]+)/, 'Control API Docker version')],
];

let failed = false;
for (const [file, value, requiredValue = expected] of values) {
  if (value !== requiredValue) { console.error(`${file}: ${value} != ${requiredValue}`); failed = true; }
}
const numericVersion = expected.split('-')[0].split('.').map(Number);
const expectedBuild = String(numericVersion[0] * 10000 + numericVersion[1] * 100 + numericVersion[2]);
for (const [label, value] of [
  ['Android versionCode', extract('sdk/mobile/android/app/build.gradle.kts', /versionCode = (\d+)/, 'Android versionCode')],
  ['iOS extension CFBundleVersion', extract('sdk/mobile/ios/Config/PacketTunnel-Info.plist', /<key>CFBundleVersion<\/key><string>([^<]+)<\/string>/, 'iOS build')],
  ['iOS project CURRENT_PROJECT_VERSION', extract('sdk/mobile/ios/project.yml', /CURRENT_PROJECT_VERSION: (\d+)/, 'iOS project build')],
]) {
  if (value !== expectedBuild) { console.error(`${label}: ${value} != ${expectedBuild}`); failed = true; }
}

for (const absolute of walk(path.resolve('deploy/docker'))) {
  if (!/\.(?:ya?ml|example|md)$/.test(absolute) && !absolute.endsWith('.env.example')) continue;
  const relative = path.relative(process.cwd(), absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(/tunnara-(?:server|agent|console|control-api|caddy-cloudflare|quic-bridge):(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/g)) {
    if (match[1] !== expected) { console.error(`${relative}: imagem ${match[1]} != ${expected}`); failed = true; }
  }
}
if (failed) process.exit(1);
console.log(`Versão sincronizada em ${values.length} pontos, Docker e build mobile ${expectedBuild}: ${expected}`);
