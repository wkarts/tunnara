import fs from 'node:fs';

const version = process.argv[2];
const numericVersion = String(version || '').split('-')[0].split('.').map(Number);
const buildNumber = numericVersion.length === 3 && numericVersion.every(Number.isInteger)
  ? numericVersion[0] * 10000 + numericVersion[1] * 100 + numericVersion[2]
  : 1;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || '')) {
  throw new Error('Versão SemVer inválida');
}

function updateJson(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = version;
  if (json.packages?.['']) json.packages[''].version = version;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

function replaceRequired(file, pattern, replacement, description) {
  const source = fs.readFileSync(file, 'utf8');
  if (!pattern.test(source)) throw new Error(`Não foi possível localizar ${description} em ${file}`);
  fs.writeFileSync(file, source.replace(pattern, replacement));
}

for (const file of [
  'package.json',
  'package-lock.json',
  'runtime/node/package.json',
  'apps/console/package.json',
  'apps/console/package-lock.json',
  'apps/console/src-tauri/tauri.conf.json',
  'apps/console/src/assets/branding/brand.json',
]) updateJson(file);

replaceRequired('Cargo.toml', /(\[workspace\.package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*)/, `$1${version}$2`, 'workspace.package.version');
replaceRequired('apps/console/src-tauri/Cargo.toml', /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*)/, `$1${version}$2`, 'package.version');
replaceRequired('apps/console/src-tauri/generic-license-tauri/Cargo.toml', /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+("\s*)/, `$1${version}$2`, 'generic-license package.version');
replaceRequired('apps/console/src/config/projectConfig.ts', /version:\s*"[^"]+"/, `version: "${version}"`, 'projectConfig.version');
replaceRequired('apps/control-api/.env.example', /^APP_VERSION=.*$/m, `APP_VERSION=${version}`, 'APP_VERSION');
replaceRequired('apps/control-api/config/app.php', /'version' => env\('APP_VERSION', '[^']+'\)/, `'version' => env('APP_VERSION', '${version}')`, 'config.app.version');
replaceRequired('runtime/node/lib/utils.mjs', /export const VERSION = '[^']+';/, `export const VERSION = '${version}';`, 'runtime VERSION');
replaceRequired('sdk/c/src/tunnara.c', /#define TUNNARA_VERSION "[^"]+"/, `#define TUNNARA_VERSION "${version}"`, 'TUNNARA_VERSION');
replaceRequired('sdk/c/CMakeLists.txt', /project\(tunnara_sdk_c VERSION [^ )]+/, `project(tunnara_sdk_c VERSION ${version}`, 'CMake project version');
replaceRequired('sdk/mobile/android/app/build.gradle.kts', /versionName = "[^"]+"/, `versionName = "${version}"`, 'Android versionName');
replaceRequired('sdk/mobile/android/app/build.gradle.kts', /versionCode = \d+/, `versionCode = ${buildNumber}`, 'Android versionCode');
replaceRequired('sdk/mobile/ios/Config/PacketTunnel-Info.plist', /<key>CFBundleShortVersionString<\/key><string>[^<]+<\/string>/, `<key>CFBundleShortVersionString</key><string>${version}</string>`, 'iOS bundle version');
replaceRequired('sdk/mobile/ios/Config/PacketTunnel-Info.plist', /<key>CFBundleVersion<\/key><string>[^<]+<\/string>/, `<key>CFBundleVersion</key><string>${buildNumber}</string>`, 'iOS bundle build');
for (const [pattern, replacement, description] of [
  [/INFOPLIST_KEY_CFBundleShortVersionString: [^\n]+/g, `INFOPLIST_KEY_CFBundleShortVersionString: ${version}`, 'iOS project short version'],
  [/MARKETING_VERSION: [^\n]+/g, `MARKETING_VERSION: ${version}`, 'iOS project marketing version'],
  [/INFOPLIST_KEY_CFBundleVersion: \d+/g, `INFOPLIST_KEY_CFBundleVersion: ${buildNumber}`, 'iOS project bundle build'],
  [/CURRENT_PROJECT_VERSION: \d+/g, `CURRENT_PROJECT_VERSION: ${buildNumber}`, 'iOS project build number'],
]) {
  replaceRequired('sdk/mobile/ios/project.yml', pattern, replacement, description);
}
replaceRequired('deploy/docker/docker-compose.yml', /(tunnara-server:)[^}\s]+/g, `$1${version}`, 'imagem do servidor');
replaceRequired('deploy/docker/docker-compose.yml', /(tunnara-console:)[^}\s]+/g, `$1${version}`, 'imagem do console');
replaceRequired('deploy/docker/.env.example', /(tunnara-server:)[^\s]+/g, `$1${version}`, 'imagem do servidor no env Docker');
replaceRequired('deploy/docker/.env.example', /(tunnara-console:)[^\s]+/g, `$1${version}`, 'imagem do console no env Docker');
replaceRequired('deploy/docker/.env.example', /(tunnara-caddy-cloudflare:)[^\s]+/g, `$1${version}`, 'imagem Caddy no env Docker');
replaceRequired('deploy/docker/.env.example', /(tunnara-quic-bridge:)[^\s]+/g, `$1${version}`, 'imagem QUIC no env Docker');
for (const file of ['deploy/docker/docker-compose.cloudflare.yml', 'deploy/docker/docker-compose.ha.yml', 'deploy/docker/docker-compose.quic.yml']) {
  const source = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, source.replace(/(tunnara-(?:server|console|caddy-cloudflare|quic-bridge):)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, `$1${version}`));
}

fs.writeFileSync('VERSION', `${version}\n`);
fs.writeFileSync('apps/console/VERSION', `${version}\n`);
console.log(`Versão atualizada para ${version}`);
