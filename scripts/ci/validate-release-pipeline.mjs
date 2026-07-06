import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const workflowsDir = path.join(root, '.github', 'workflows');
const workflows = fs.readdirSync(workflowsDir)
  .filter((name) => /\.ya?ml$/i.test(name))
  .map((name) => ({ name, content: fs.readFileSync(path.join(workflowsDir, name), 'utf8') }));
const requireText = (content, expected, label) => {
  if (!content.includes(expected)) errors.push(`${label} não contém: ${expected}`);
};

for (const workflow of workflows) {
  if (/actions\/(upload|download)-artifact@/i.test(workflow.content)) {
    errors.push(`${workflow.name}: Actions Artifact Storage não deve ser usado; envie arquivos diretamente à GitHub Release.`);
  }
  if (/macos-(13|14)(?!-)/i.test(workflow.content)) {
    errors.push(`${workflow.name}: runners macos-13/macos-14 não são permitidos.`);
  }
  if (/\npush:\s*\n\s+tags:/m.test(workflow.content)) {
    errors.push(`${workflow.name}: não dependa de tag criada pelo GITHUB_TOKEN para disparar outro workflow.`);
  }
}

const release = read('.github/workflows/release.yml');
for (const expected of [
  'npm run sdk:c:build',
  'npm run artifacts:package',
  'upload-release-assets.sh',
  'release_id=',
  'A release publicada $tag é imutável',
  'uses: ./.github/workflows/runtime-release.yml',
  'uses: ./.github/workflows/sdk-build.yml',
  'uses: ./.github/workflows/desktop-release.yml',
  'uses: ./.github/workflows/mobile-release.yml',
  'uses: ./.github/workflows/docker-publish.yml',
  '--latest=false',
  '--prerelease',
]) requireText(release, expected, 'release.yml');
if (!release.includes('paths:\n      - VERSION')) errors.push('release.yml deve publicar apenas quando VERSION mudar em main.');
if (/semantic-release/.test(release)) errors.push('release.yml não deve depender de semantic-release.');
if (/gh workflow run/.test(release)) errors.push('release.yml deve usar reusable workflows, não dispatch assíncrono.');
if (/gh release edit[\s\S]{0,200}--draft=true/.test(release)) errors.push('release.yml não pode reabrir releases publicadas.');

const reusable = ['runtime-release.yml', 'sdk-build.yml', 'desktop-release.yml', 'mobile-release.yml', 'docker-publish.yml'];
for (const name of reusable) {
  const content = read(`.github/workflows/${name}`);
  if (!/workflow_call:/.test(content)) errors.push(`${name}: workflow_call ausente.`);
  if (!content.includes('release_tag:')) errors.push(`${name}: input release_tag ausente.`);
  if (!content.includes('release_ref:')) errors.push(`${name}: input release_ref ausente.`);
  if (!content.includes('ref: ${{ inputs.release_ref || inputs.release_tag }}')) errors.push(`${name}: checkout não está fixado na ref imutável da release.`);
}

const runtime = read('.github/workflows/runtime-release.yml');
const sdk = read('.github/workflows/sdk-build.yml');
const desktop = read('.github/workflows/desktop-release.yml');
const mobile = read('.github/workflows/mobile-release.yml');
for (const [content, label, checksum] of [
  [runtime, 'runtime-release.yml', 'SHA256SUMS-runtime-${{ matrix.suffix }}.txt'],
  [sdk, 'sdk-build.yml', 'SHA256SUMS-sdk-c-${{ matrix.suffix }}.txt'],
]) {
  requireText(content, 'upload-release-assets.sh', label);
  requireText(content, checksum, label);
  if (/softprops\/action-gh-release/.test(content)) errors.push(`${label}: upload concorrente via softprops foi substituído pelo uploader idempotente.`);
}
for (const expected of ['release_id:', 'releaseId: ${{ inputs.release_id }}', 'uploadWorkflowArtifacts: false', 'Configure optional updater and Apple signing']) {
  requireText(desktop, expected, 'desktop-release.yml');
}
if (/gh release create/.test(mobile)) errors.push('mobile-release.yml não deve criar release paralela; deve usar o draft coordenado.');
for (const expected of ['SHA256SUMS-ios.txt', 'upload-release-assets.sh', 'base64-decode.sh']) {
  requireText(mobile, expected, 'mobile-release.yml');
}

const sea = read('scripts/release/build-sea.mjs');
for (const expected of ["import { buildSync } from 'esbuild'", 'buildSync({', "resolvePackageBin('postject'", 'run(process.execPath']) {
  requireText(sea, expected, 'build-sea.mjs');
}
if (/\.cmd'\s*:\s*'esbuild/.test(sea) || /\.cmd'\s*:\s*'postject/.test(sea)) errors.push('build-sea.mjs não deve executar wrappers .cmd com spawnSync.');

const packageScript = read('scripts/release/package-artifacts.sh');
requireText(packageScript, 'SHA256SUMS-core.txt', 'package-artifacts.sh');
const androidScript = read('sdk/mobile/android/scripts/build-artifacts.sh');
const iosScript = read('sdk/mobile/ios/scripts/build-artifacts.sh');
for (const expected of ['SHA256SUMS-android.txt', 'build-metadata-android.json']) requireText(androidScript, expected, 'Android artifacts');
for (const expected of ['SHA256SUMS-ios.txt', 'build-metadata-ios.json']) requireText(iosScript, expected, 'iOS artifacts');

const docker = read('.github/workflows/docker-publish.yml');
for (const image of ['server', 'agent', 'console', 'control-api', 'quic-bridge', 'caddy-cloudflare']) {
  if (!docker.includes(`image: ${image}`)) errors.push(`docker-publish.yml não publica a imagem ${image}.`);
}
if (!docker.includes('linux/amd64,linux/arm64')) errors.push('docker-publish.yml não é multi-arquitetura.');
if (!docker.includes('sbom: true') || !docker.includes('provenance: mode=max')) errors.push('docker-publish.yml deve gerar SBOM e provenance.');

const validationOnly = ['ci.yml', 'mobile.yml', 'native-preview.yml', 'storage-matrix.yml', 'codeql.yml'];
for (const name of validationOnly) {
  const content = read(`.github/workflows/${name}`);
  if (/\n\s{2}push:\s*\n\s{4}branches:\s*\[main(?:, next)?\]/m.test(content)) errors.push(`${name}: validação duplicada em push para main.`);
}

const storage = read('.github/workflows/storage-matrix.yml');
const keyMatch = storage.match(/APP_KEY:\s*base64:([^\s]+)/);
if (!keyMatch) errors.push('storage-matrix.yml: APP_KEY de teste ausente.');
else if (Buffer.from(keyMatch[1], 'base64').length !== 32) errors.push('storage-matrix.yml: APP_KEY deve decodificar para exatamente 32 bytes.');

const consolePackage = JSON.parse(read('apps/console/package.json'));
const consoleLock = JSON.parse(read('apps/console/package-lock.json'));
const packageDeps = consolePackage.dependencies ?? {};
const lockDeps = consoleLock.packages?.['']?.dependencies ?? {};
const packageDevDeps = consolePackage.devDependencies ?? {};
const lockDevDeps = consoleLock.packages?.['']?.devDependencies ?? {};
for (const dependency of ['pinia', 'vue-router']) {
  if (packageDeps[dependency] !== lockDeps[dependency]) errors.push(`Console: ${dependency} difere entre package.json e package-lock.json.`);
}
if (packageDevDeps.esbuild !== lockDevDeps.esbuild) errors.push('Console: esbuild explícito difere entre package.json e package-lock.json.');
if (!/^4\./.test(packageDeps['vue-router'] ?? '')) errors.push('Console: vue-router deve permanecer em 4.x.');
if (!/^2\./.test(packageDeps.pinia ?? '')) errors.push('Console: pinia deve permanecer em 2.x.');

if (errors.length) {
  console.error('RELEASE_PIPELINE_INVALID');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('RELEASE_PIPELINE_OK release imutável, checkout por tag, assets exclusivos, uploads idempotentes, mobile e Tauri coordenados.');
