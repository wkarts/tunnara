import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const workflowsDir = path.join(root, '.github', 'workflows');
const workflows = fs.readdirSync(workflowsDir)
  .filter((name) => /\.ya?ml$/i.test(name))
  .map((name) => ({ name, content: fs.readFileSync(path.join(workflowsDir, name), 'utf8') }));

for (const workflow of workflows) {
  if (/actions\/(upload|download)-artifact@/i.test(workflow.content)) {
    errors.push(`${workflow.name}: Actions Artifact Storage não deve ser usado; envie arquivos diretamente à GitHub Release.`);
  }
  if (/macos-(13|14)(?!-)/i.test(workflow.content)) {
    errors.push(`${workflow.name}: runners macos-13/macos-14 não são permitidos na matriz atual.`);
  }
  if (/\npush:\s*\n\s+tags:/m.test(workflow.content)) {
    errors.push(`${workflow.name}: não dependa de tag criada pelo GITHUB_TOKEN para disparar outro workflow.`);
  }
}

const release = read('.github/workflows/release.yml');
for (const expected of [
  'npm run sdk:c:build',
  'npm run artifacts:package',
  'scripts/release/upload-release-assets.sh',
  'git/refs/tags/$tag',
  'gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --draft=false',
  '--json isDraft',
  "AUTO_REBUILD: ${{ github.event_name == 'push' }}",
  'rebuild_requested=false',
  `if [[ "$AUTO_REBUILD" == 'true' || "$FORCE_REBUILD" == 'true' ]]`,
  `if [[ "$is_draft" == 'true' || "$rebuild_requested" == 'true' ]]`,
  'rebuild_requested=$rebuild_requested',
  'uses: ./.github/workflows/runtime-release.yml',
  'uses: ./.github/workflows/sdk-build.yml',
  'uses: ./.github/workflows/desktop-release.yml',
  'uses: ./.github/workflows/mobile-release.yml',
  'uses: ./.github/workflows/docker-publish.yml',
]) {
  if (!release.includes(expected)) errors.push(`release.yml não contém: ${expected}`);
}
for (const triggerPath of [
  '- VERSION',
  '- .github/workflows/release.yml',
  '- .github/workflows/runtime-release.yml',
  '- .github/workflows/sdk-build.yml',
  '- .github/workflows/desktop-release.yml',
  '- .github/workflows/mobile-release.yml',
  '- scripts/release/**',
  '- sdk/mobile/ios/scripts/**',
]) {
  if (!release.includes(triggerPath)) errors.push(`release.yml não observa alteração em ${triggerPath.slice(2)}.`);
}
if (!release.includes('--draft')) errors.push('release.yml deve criar a release em draft antes dos builds.');
if (/semantic-release/.test(release)) errors.push('release.yml não deve depender de semantic-release.');
if (/gh workflow run/.test(release)) errors.push('release.yml deve usar reusable workflows, não dispatch assíncrono por gh workflow run.');
if (/elif \[\[ "\$FORCE_REBUILD" == 'true' \]\]/.test(release)) {
  errors.push('release.yml não deve limitar a reconstrução automática somente ao workflow_dispatch.');
}
if (!release.includes('A release publicada $tag será reaberta em draft')) {
  errors.push('release.yml deve reabrir uma release publicada quando uma correção do pipeline for mesclada.');
}
if (!/AUTO_REBUILD:[^\n]*github\.event_name == 'push'/.test(release)) {
  errors.push('release.yml deve tratar o push automático do pipeline como solicitação de rebuild.');
}

const reusable = ['runtime-release.yml', 'sdk-build.yml', 'desktop-release.yml', 'mobile-release.yml', 'docker-publish.yml'];
for (const name of reusable) {
  const content = read(`.github/workflows/${name}`);
  if (!/workflow_call:/.test(content)) errors.push(`${name}: workflow_call ausente.`);
  if (!content.includes('release_tag:')) errors.push(`${name}: input release_tag ausente.`);
  if (!/upload-release-assets\.sh|tauri-apps\/tauri-action@v1/.test(content) && name !== 'docker-publish.yml') {
    errors.push(`${name}: não anexa arquivos diretamente à GitHub Release.`);
  }
}

const desktop = read('.github/workflows/desktop-release.yml');
if (!desktop.includes('releaseDraft: true')) errors.push('desktop-release.yml deve anexar instaladores à release draft existente.');
for (const expected of [
  'Configure optional updater signing',
  'Configure optional macOS signing and notarization',
  'TUNNARA_APPLE_CERTIFICATE:',
  'uploadUpdaterJson:',
  'uploadUpdaterSignatures:',
]) {
  if (!desktop.includes(expected)) errors.push(`desktop-release.yml não contém: ${expected}`);
}
const tauriActionBlock = desktop.split('- name: Build and upload Tauri bundles')[1] ?? '';
if (/APPLE_CERTIFICATE:\s*\$\{\{\s*secrets\./.test(tauriActionBlock)) {
  errors.push('desktop-release.yml não deve passar APPLE_CERTIFICATE vazio diretamente ao tauri-action.');
}

const runtimeRelease = read('.github/workflows/runtime-release.yml');
const sdkRelease = read('.github/workflows/sdk-build.yml');
const mobileRelease = read('.github/workflows/mobile-release.yml');
for (const [name, content] of [
  ['runtime-release.yml', runtimeRelease],
  ['sdk-build.yml', sdkRelease],
  ['mobile-release.yml', mobileRelease],
]) {
  if (!content.includes('scripts/release/upload-release-assets.sh')) {
    errors.push(`${name}: upload idempotente com --clobber centralizado está ausente.`);
  }
  if (/softprops\/action-gh-release@/.test(content)) {
    errors.push(`${name}: não use upload concorrente por softprops para matrizes de release.`);
  }
}

const releaseUploader = read('scripts/release/upload-release-assets.sh');
for (const expected of ['gh release upload', '--clobber', 'MAX_ATTEMPTS', 'shopt -s nullglob']) {
  if (!releaseUploader.includes(expected)) errors.push(`upload-release-assets.sh não contém: ${expected}`);
}

const seaBuilder = read('scripts/release/build-sea.mjs');
for (const expected of ['esbuild/bin/esbuild', 'postject/dist/cli.js', 'run(process.execPath', 'result.error']) {
  if (!seaBuilder.includes(expected)) errors.push(`build-sea.mjs não contém proteção multiplataforma: ${expected}`);
}
if (seaBuilder.includes("node_modules', '.bin'")) {
  errors.push('build-sea.mjs não deve executar wrappers .cmd de node_modules/.bin no Windows.');
}

const corePackager = read('scripts/release/package-artifacts.sh');
const androidArtifacts = read('sdk/mobile/android/scripts/build-artifacts.sh');
const iosArtifacts = read('sdk/mobile/ios/scripts/build-artifacts.sh');
for (const [name, content, expected] of [
  ['package-artifacts.sh', corePackager, ['SHA256SUMS-core.txt']],
  ['build-artifacts.sh Android', androidArtifacts, ['SHA256SUMS-android.txt', 'build-metadata-android.json']],
  ['build-artifacts.sh iOS', iosArtifacts, ['SHA256SUMS-ios.txt', 'build-metadata-ios.json']],
]) {
  for (const item of expected) {
    if (!content.includes(item)) errors.push(`${name} não contém asset com nome exclusivo: ${item}`);
  }
}
for (const expected of [
  'bash "$ROOT/scripts/prepare-wireguard-kit.sh"',
  'bash "$ROOT/scripts/sign-and-export.sh"',
  'shasum -a 256',
]) {
  if (!iosArtifacts.includes(expected)) errors.push(`build-artifacts.sh iOS não contém: ${expected}`);
}
if (/sort -z|sha256sum/.test(iosArtifacts)) {
  errors.push('build-artifacts.sh iOS deve usar ferramentas de checksum compatíveis com macOS BSD.');
}
if (!mobileRelease.includes('base64 -D')) {
  errors.push('mobile-release.yml deve decodificar secrets iOS com a opção BSD/macOS base64 -D.');
}
if (!release.includes('SHA256SUMS.txt build-metadata.json')) {
  errors.push('release.yml deve remover assets legados com nomes genéricos da release draft.');
}

const docker = read('.github/workflows/docker-publish.yml');
for (const image of ['server', 'agent', 'console', 'control-api', 'quic-bridge', 'caddy-cloudflare']) {
  if (!docker.includes(`image: ${image}`)) errors.push(`docker-publish.yml não publica a imagem ${image}.`);
}
if (!docker.includes('linux/amd64,linux/arm64')) errors.push('docker-publish.yml não é multi-arquitetura.');
for (const expected of [
  'docker/setup-buildx-action@v4',
  'docker/metadata-action@v6',
  'docker/build-push-action@v7',
  'scope=tunnara-${{ matrix.image }}',
]) {
  if (!docker.includes(expected)) errors.push(`docker-publish.yml não contém: ${expected}`);
}

const validationOnly = ['ci.yml', 'mobile.yml', 'native-preview.yml', 'storage-matrix.yml', 'codeql.yml'];
for (const name of validationOnly) {
  const content = read(`.github/workflows/${name}`);
  if (/\n\s{2}push:\s*\n\s{4}branches:\s*\[main(?:, next)?\]/m.test(content)) {
    errors.push(`${name}: validação duplicada em push para main.`);
  }
}

const storage = read('.github/workflows/storage-matrix.yml');
const keyMatch = storage.match(/APP_KEY:\s*base64:([^\s]+)/);
if (!keyMatch) {
  errors.push('storage-matrix.yml: APP_KEY de teste ausente.');
} else if (Buffer.from(keyMatch[1], 'base64').length !== 32) {
  errors.push('storage-matrix.yml: APP_KEY deve decodificar para exatamente 32 bytes.');
}

const consolePackage = JSON.parse(read('apps/console/package.json'));
const consoleLock = JSON.parse(read('apps/console/package-lock.json'));
const packageDeps = consolePackage.dependencies ?? {};
const lockDeps = consoleLock.packages?.['']?.dependencies ?? {};
for (const dependency of ['pinia', 'vue-router']) {
  if (packageDeps[dependency] !== lockDeps[dependency]) {
    errors.push(`Console: ${dependency} difere entre package.json e package-lock.json.`);
  }
}
if (!/^4\./.test(packageDeps['vue-router'] ?? '')) errors.push('Console: vue-router deve permanecer em 4.x.');
if (!/^2\./.test(packageDeps.pinia ?? '')) errors.push('Console: pinia deve permanecer em 2.x.');

if (errors.length) {
  console.error('RELEASE_PIPELINE_INVALID');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('RELEASE_PIPELINE_OK draft coordenado, reusable workflows, assets diretos, runners atuais e containers validados.');
