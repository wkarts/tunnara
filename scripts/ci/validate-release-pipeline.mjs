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
  'release_version:',
  'release_sha:',
  'release_id:',
  'ref: ${{ inputs.release_sha }}',
  'npm run sdk:c:build',
  'npm run artifacts:package',
  'scripts/release/upload-release-assets.sh',
  'gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --draft=false',
  '--json isDraft',
  'A release publicada $tag é imutável',
  'A tag existente $tag aponta para',
  '--json isDraft,targetCommitish',
  'A draft $tag pertence ao commit',
  'uses: ./.github/workflows/runtime-release.yml',
  'uses: ./.github/workflows/sdk-build.yml',
  'uses: ./.github/workflows/desktop-release.yml',
  'uses: ./.github/workflows/mobile-release.yml',
  'uses: ./.github/workflows/docker-publish.yml',
  'source_sha: ${{ needs.prepare.outputs.release_sha }}',
  'release_id: ${{ needs.prepare.outputs.release_id }}',
]) {
  if (!release.includes(expected)) errors.push(`release.yml não contém: ${expected}`);
}
if (/\n\s{2}push:/m.test(release)) errors.push('release.yml deve ser iniciado por workflow_dispatch coordenado, sem corrida por push em VERSION.');
if (release.includes('force_rebuild')) errors.push('release.yml não deve reabrir releases publicadas por force_rebuild.');
if (!release.includes('--prerelease')) errors.push('release.yml deve marcar versões prerelease corretamente.');
if (/semantic-release/.test(release)) errors.push('release.yml não deve depender de semantic-release.');
if (/gh workflow run/.test(release)) errors.push('release.yml deve usar reusable workflows, não dispatch assíncrono interno.');

const versionWorkflow = read('.github/workflows/version-after-merge.yml');
for (const expected of [
  'options:',
  '- auto',
  '- prerelease',
  '- stable',
  'release:prerelease',
  'release:stable',
  "--jq '.[].tag_name'",
  "git tag --list 'v*'",
  'scripts/version/max-version.mjs',
  'scripts/version/next-version.mjs',
  '-f release_version="$VERSION"',
  '-f release_sha="$RELEASE_SHA"',
  'npm run version:test',
  'npm run validate:mobile',
]) {
  if (!versionWorkflow.includes(expected)) errors.push(`version-after-merge.yml não contém: ${expected}`);
}

const uploader = read('scripts/release/upload-release-assets.sh');
for (const expected of ['--clobber', 'for attempt in 1 2 3', 'LC_ALL=C sort']) {
  if (!uploader.includes(expected)) errors.push(`Uploader de releases não contém: ${expected}`);
}
if (/mapfile|sort\s+-z/.test(uploader)) errors.push('Uploader de releases deve funcionar no Bash 3.2/macOS, sem mapfile ou sort -z.');

const reusable = ['runtime-release.yml', 'sdk-build.yml', 'desktop-release.yml', 'mobile-release.yml', 'docker-publish.yml'];
for (const name of reusable) {
  const content = read(`.github/workflows/${name}`);
  if (!/workflow_call:/.test(content)) errors.push(`${name}: workflow_call ausente.`);
  if (!content.includes('release_tag:')) errors.push(`${name}: input release_tag ausente.`);
  if (!content.includes('source_sha:')) errors.push(`${name}: input source_sha ausente.`);
  if (!content.includes('ref: ${{ inputs.source_sha || github.sha }}')) errors.push(`${name}: checkout não está fixado no source_sha.`);
  if (!/upload-release-assets\.sh|tauri-apps\/tauri-action@v1/.test(content) && name !== 'docker-publish.yml') {
    errors.push(`${name}: não anexa arquivos diretamente e de forma idempotente à GitHub Release.`);
  }
}

const runtime = read('.github/workflows/runtime-release.yml');
const sdk = read('.github/workflows/sdk-build.yml');
if (/softprops\/action-gh-release/.test(`${runtime}\n${sdk}`)) {
  errors.push('Runtime/SDK devem usar o uploader sequencial e idempotente, não uploads concorrentes por action.');
}
for (const expected of ['SHA256SUMS-runtime-', 'upload-release-assets.sh']) {
  if (!runtime.includes(expected)) errors.push(`runtime-release.yml não contém: ${expected}`);
}
for (const expected of ['SHA256SUMS-sdk-', 'upload-release-assets.sh']) {
  if (!sdk.includes(expected)) errors.push(`sdk-build.yml não contém: ${expected}`);
}

const desktop = read('.github/workflows/desktop-release.yml');
for (const expected of ['releaseId: ${{ inputs.release_id }}', 'releaseDraft: true', 'uploadWorkflowArtifacts: false']) {
  if (!desktop.includes(expected)) errors.push(`desktop-release.yml não contém: ${expected}`);
}

const mobileRelease = read('.github/workflows/mobile-release.yml');
if (/gh release create/.test(mobileRelease)) errors.push('mobile-release.yml não deve criar release paralela; somente validar a draft coordenada.');
if (!mobileRelease.includes('upload-release-assets.sh')) errors.push('mobile-release.yml deve usar uploader idempotente.');

const docker = read('.github/workflows/docker-publish.yml');
for (const image of ['server', 'agent', 'console', 'control-api', 'quic-bridge', 'caddy-cloudflare']) {
  if (!docker.includes(`image: ${image}`)) errors.push(`docker-publish.yml não publica a imagem ${image}.`);
}
if (!docker.includes('linux/amd64,linux/arm64')) errors.push('docker-publish.yml não é multi-arquitetura.');
if (!docker.includes("value=latest,enable=${{ steps.version.outputs.is_prerelease == 'false' }}")) {
  errors.push('docker-publish.yml não protege a tag latest contra prereleases.');
}
if (!docker.includes("value=rc,enable=${{ steps.version.outputs.is_prerelease == 'true' }}")) {
  errors.push('docker-publish.yml não publica o canal rc para prereleases.');
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
const packageDevDeps = consolePackage.devDependencies ?? {};
const lockDeps = consoleLock.packages?.['']?.dependencies ?? {};
const lockDevDeps = consoleLock.packages?.['']?.devDependencies ?? {};
for (const dependency of ['pinia', 'vue-router']) {
  if (packageDeps[dependency] !== lockDeps[dependency]) {
    errors.push(`Console: ${dependency} difere entre package.json e package-lock.json.`);
  }
}
if (packageDevDeps.esbuild !== lockDevDeps.esbuild) errors.push('Console: esbuild difere entre package.json e package-lock.json.');
if (!consoleLock.packages?.['node_modules/esbuild']) errors.push('Console: pacote esbuild não foi materializado no package-lock.json.');
if (!/^4\./.test(packageDeps['vue-router'] ?? '')) errors.push('Console: vue-router deve permanecer em 4.x.');
if (!/^2\./.test(packageDeps.pinia ?? '')) errors.push('Console: pinia deve permanecer em 2.x.');

const seaBuilder = read('scripts/release/build-sea.mjs');
if (!/from ['"]esbuild['"]/.test(seaBuilder)
    || !/await esbuildBuild\(/.test(seaBuilder)
    || !/path\.join\(root, 'node_modules', 'postject', 'dist', 'cli\.js'\)/.test(seaBuilder)
    || !/run\(process\.execPath, \[postject/.test(seaBuilder)) {
  errors.push('build-sea.mjs deve usar a API JavaScript do esbuild e executar somente o CLI JavaScript do postject por Node.');
}
if (/run\(process\.execPath,\s*\[esbuild/.test(seaBuilder)) {
  errors.push('build-sea.mjs não pode executar o binário nativo do esbuild por Node.');
}
if (!fs.existsSync(path.join(root, 'scripts/ci/validate-sea-builder.mjs'))) {
  errors.push('Validador real do bundler SEA ausente.');
}
if (!release.includes('npm run validate:sea')) {
  errors.push('release.yml deve executar o preflight SEA antes do build de artefatos.');
}
const fastCi = read('.github/workflows/ci.yml');
if (!fastCi.includes('npm run validate:sea')) {
  errors.push('ci.yml deve executar o preflight SEA em Pull Requests.');
}

for (const file of [
  'scripts/version/version-utils.mjs',
  'scripts/version/max-version.mjs',
  'scripts/version/next-version.mjs',
  'scripts/version/version-utils.test.mjs',
]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Versionamento: arquivo obrigatório ausente: ${file}.`);
}

if (errors.length) {
  console.error('RELEASE_PIPELINE_INVALID');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('RELEASE_PIPELINE_OK autoversionamento SemVer/RC, tags e releases imutáveis, commit fixado, uploads portáveis/idempotentes e containers validados.');
