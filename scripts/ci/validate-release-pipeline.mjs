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
  'gh release upload',
  'gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --draft=false',
  '--json isDraft',
  'uses: ./.github/workflows/runtime-release.yml',
  'uses: ./.github/workflows/sdk-build.yml',
  'uses: ./.github/workflows/desktop-release.yml',
  'uses: ./.github/workflows/mobile-release.yml',
  'uses: ./.github/workflows/docker-publish.yml',
]) {
  if (!release.includes(expected)) errors.push(`release.yml não contém: ${expected}`);
}
if (!release.includes('paths:\n      - VERSION')) errors.push('release.yml deve automatizar a publicação somente quando VERSION mudar em main.');
if (!release.includes('--draft')) errors.push('release.yml deve criar a release em draft antes dos builds.');
if (/semantic-release/.test(release)) errors.push('release.yml não deve depender de semantic-release.');
if (/gh workflow run/.test(release)) errors.push('release.yml deve usar reusable workflows, não dispatch assíncrono por gh workflow run.');

const reusable = ['runtime-release.yml', 'sdk-build.yml', 'desktop-release.yml', 'mobile-release.yml', 'docker-publish.yml'];
for (const name of reusable) {
  const content = read(`.github/workflows/${name}`);
  if (!/workflow_call:/.test(content)) errors.push(`${name}: workflow_call ausente.`);
  if (!content.includes('release_tag:')) errors.push(`${name}: input release_tag ausente.`);
  if (!/softprops\/action-gh-release@v2|gh release upload|tauri-apps\/tauri-action@v1/.test(content) && name !== 'docker-publish.yml') {
    errors.push(`${name}: não anexa arquivos diretamente à GitHub Release.`);
  }
}

const desktop = read('.github/workflows/desktop-release.yml');
if (!desktop.includes('releaseDraft: true')) errors.push('desktop-release.yml deve anexar instaladores à release draft existente.');

const docker = read('.github/workflows/docker-publish.yml');
for (const image of ['server', 'agent', 'console', 'control-api', 'quic-bridge', 'caddy-cloudflare']) {
  if (!docker.includes(`image: ${image}`)) errors.push(`docker-publish.yml não publica a imagem ${image}.`);
}
if (!docker.includes('linux/amd64,linux/arm64')) errors.push('docker-publish.yml não é multi-arquitetura.');

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
