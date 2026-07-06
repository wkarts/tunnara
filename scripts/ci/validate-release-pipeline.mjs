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
  'scripts/release/resolve-release-id.sh',
  'repos/$GITHUB_REPOSITORY/releases?per_page=100',
  '--method POST',
  'release_id="$(jq -r .id',
  'A release publicada $tag é imutável',
  'A tag existente $tag aponta para',
  'A draft $tag pertence ao commit',
  'gh api --method PATCH "repos/$GITHUB_REPOSITORY/releases/$RELEASE_ID" -F draft=false',
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
if (!release.includes('-F "prerelease=$prerelease"')) errors.push('release.yml deve marcar versões prerelease corretamente.');
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
for (const expected of [
  'resolve-release-id.sh',
  'uploads.github.com',
  'Content-Type: application/octet-stream',
  'for attempt in 1 2 3',
  'LC_ALL=C sort',
  'delete_existing_asset',
  'releases/assets/',
  '--method DELETE',
]) {
  if (!uploader.includes(expected)) errors.push(`Uploader de releases não contém: ${expected}`);
}
if (/releases\/tags\//.test(uploader)) errors.push('Uploader não pode resolver draft pelo endpoint /releases/tags/{tag}, que retorna 404 para drafts.');
if (/gh release upload/.test(uploader)) errors.push('Uploader deve publicar pelo release_id no endpoint uploads.github.com, sem resolver a draft novamente por tag.');
if (/mapfile|sort\s+-z/.test(uploader)) errors.push('Uploader de releases deve funcionar no Bash 3.2/macOS, sem mapfile ou sort -z.');

const releaseResolver = read('scripts/release/resolve-release-id.sh');
for (const expected of ['releases?per_page=100', '.tag_name == $tag', 'releases/$PREFERRED_ID', 'Mais de uma release encontrada']) {
  if (!releaseResolver.includes(expected)) errors.push(`Resolver de release_id não contém: ${expected}`);
}
if (/releases\/tags\//.test(releaseResolver)) errors.push('Resolver de release_id não pode usar /releases/tags/{tag} para drafts.');

const reusable = ['runtime-release.yml', 'sdk-build.yml', 'desktop-release.yml', 'mobile-release.yml', 'docker-publish.yml'];
for (const name of reusable) {
  const content = read(`.github/workflows/${name}`);
  if (!/workflow_call:/.test(content)) errors.push(`${name}: workflow_call ausente.`);
  if (!content.includes('release_tag:')) errors.push(`${name}: input release_tag ausente.`);
  if (!content.includes('source_sha:')) errors.push(`${name}: input source_sha ausente.`);
  if (!content.includes('ref: ${{ inputs.source_sha || github.sha }}')) errors.push(`${name}: checkout não está fixado no source_sha.`);
  if (name !== 'docker-publish.yml' && !content.includes('release_id:')) errors.push(`${name}: input release_id ausente.`);
  if (!/upload-release-assets\.sh|tauri-apps\/tauri-action@v1/.test(content) && name !== 'docker-publish.yml') {
    errors.push(`${name}: não anexa arquivos diretamente e de forma idempotente à GitHub Release.`);
  }
}

const runtime = read('.github/workflows/runtime-release.yml');
const sdk = read('.github/workflows/sdk-build.yml');
for (const [name, content] of [
  ['runtime-release.yml', runtime],
  ['sdk-build.yml', sdk],
  ['mobile-release.yml', read('.github/workflows/mobile-release.yml')],
]) {
  if (!content.includes('RELEASE_ID: ${{ inputs.release_id }}') && name !== 'mobile-release.yml') {
    errors.push(`${name}: release_id coordenado não é propagado ao uploader.`);
  }
  if (!content.includes('upload-release-assets.sh "$TAG"') || !content.includes('"$RELEASE_ID"')) {
    errors.push(`${name}: uploader não recebe release_id explícito.`);
  }
}
if (/softprops\/action-gh-release/.test(`${runtime}\n${sdk}`)) {
  errors.push('Runtime/SDK devem usar o uploader sequencial e idempotente, não uploads concorrentes por action.');
}
for (const expected of ['SHA256SUMS-runtime-', 'upload-release-assets.sh']) {
  if (!runtime.includes(expected)) errors.push(`runtime-release.yml não contém: ${expected}`);
}
for (const expected of ['SHA256SUMS-sdk-', 'upload-release-assets.sh']) {
  if (!sdk.includes(expected)) errors.push(`sdk-build.yml não contém: ${expected}`);
}

const windowsTauriConfig = JSON.parse(read('apps/console/src-tauri/tauri.windows.conf.json'));
if (!/^\d+\.\d+\.\d+(?:-\d+)?$/.test(windowsTauriConfig.version)) {
  errors.push('tauri.windows.conf.json deve usar versão MSI com prerelease exclusivamente numérica.');
}
if (windowsTauriConfig.version.includes('-') && Number(windowsTauriConfig.version.split('-')[1]) > 65535) {
  errors.push('tauri.windows.conf.json excede o limite de prerelease MSI 65535.');
}

const desktop = read('.github/workflows/desktop-release.yml');
for (const expected of ['releaseId: ${{ inputs.release_id }}', 'releaseDraft: true', 'uploadWorkflowArtifacts: false']) {
  if (!desktop.includes(expected)) errors.push(`desktop-release.yml não contém: ${expected}`);
}

const mobileRelease = read('.github/workflows/mobile-release.yml');
if (/gh release create/.test(mobileRelease)) errors.push('mobile-release.yml não deve criar release paralela; somente validar a draft coordenada.');
if (!mobileRelease.includes('upload-release-assets.sh')) errors.push('mobile-release.yml deve usar uploader idempotente.');
if (!mobileRelease.includes('release_id: ${{ steps.release.outputs.value }}')) errors.push('mobile-release.yml deve propagar o release_id coordenado aos jobs Android/iOS.');
if ((mobileRelease.match(/RELEASE_ID: \$\{\{ needs\.prepare-release\.outputs\.release_id \}\}/g) ?? []).length !== 2) {
  errors.push('mobile-release.yml deve fornecer release_id exatamente aos dois uploads mobile.');
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
]) {
  if (!docker.includes(expected)) errors.push(`docker-publish.yml não contém a action atual: ${expected}`);
}
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


if (!fs.existsSync(path.join(root, 'scripts/ci/test-release-uploader.mjs'))) {
  errors.push('Teste funcional do uploader por release_id ausente.');
}
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


const nativeValidator = read('scripts/ci/validate-native-dependencies.mjs');
if (!nativeValidator.includes('NATIVE_DEPENDENCIES_OK')) errors.push('Validador de dependências nativas ausente ou inválido.');
if (!release.includes('npm run validate:native-deps')) errors.push('release.yml deve validar dependências nativas antes dos builds.');
if (!fastCi.includes('npm run validate:native-deps')) errors.push('ci.yml deve validar dependências nativas no Pull Request.');
const nativePreview = read('.github/workflows/native-preview.yml');
for (const expected of ['cargo check --workspace --all-targets', 'cargo check --manifest-path apps/console/src-tauri/Cargo.toml --all-targets', "apps/console/src-tauri/**"]) {
  if (!nativePreview.includes(expected)) errors.push(`native-preview.yml não contém: ${expected}`);
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
