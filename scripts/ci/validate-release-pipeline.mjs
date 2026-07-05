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
    errors.push(`${workflow.name}: Actions Artifact Storage não deve ser utilizado; envie arquivos diretamente à GitHub Release.`);
  }
  if (/macos-13/i.test(workflow.content)) {
    errors.push(`${workflow.name}: runner macos-13 não é permitido.`);
  }
}

const release = read('.github/workflows/release.yml');
for (const expected of [
  'npm run sdk:c:build',
  'npm run artifacts:package',
  'gh release upload',
  'gh workflow run',
  'runtime-release.yml',
  'sdk-build.yml',
  'desktop-release.yml',
  'mobile-release.yml',
  'docker-publish.yml',
]) {
  if (!release.includes(expected)) errors.push(`release.yml não contém a etapa obrigatória: ${expected}`);
}
if (/semantic-release/.test(release)) {
  errors.push('release.yml não deve depender de semantic-release para a primeira versão após o merge.');
}

const validationOnly = ['ci.yml', 'mobile.yml', 'native-preview.yml', 'storage-matrix.yml', 'codeql.yml'];
for (const name of validationOnly) {
  const content = read(`.github/workflows/${name}`);
  if (/\n\s{2}push:\s*\n\s{4}branches:\s*\[main(?:, next)?\]/m.test(content)) {
    errors.push(`${name}: validação duplicada em push para main; o pós-merge deve ser responsabilidade do release.yml.`);
  }
}

const storage = read('.github/workflows/storage-matrix.yml');
const keyMatch = storage.match(/APP_KEY:\s*base64:([^\s]+)/);
if (!keyMatch) {
  errors.push('storage-matrix.yml: APP_KEY de teste ausente.');
} else {
  const decoded = Buffer.from(keyMatch[1], 'base64');
  if (decoded.length !== 32) {
    errors.push(`storage-matrix.yml: APP_KEY decodifica para ${decoded.length} bytes; esperado: 32.`);
  }
}

const consolePackage = JSON.parse(read('apps/console/package.json'));
const consoleLock = JSON.parse(read('apps/console/package-lock.json'));
const packageDeps = consolePackage.dependencies ?? {};
const lockDeps = consoleLock.packages?.['']?.dependencies ?? {};
for (const dependency of ['pinia', 'vue-router']) {
  if (packageDeps[dependency] !== lockDeps[dependency]) {
    errors.push(`Console: ${dependency} difere entre package.json (${packageDeps[dependency]}) e package-lock.json (${lockDeps[dependency]}).`);
  }
}
if (!/^4\./.test(packageDeps['vue-router'] ?? '')) {
  errors.push(`Console: vue-router deve permanecer na linha 4.x compatível com o template atual; recebido ${packageDeps['vue-router']}.`);
}
if (!/^2\./.test(packageDeps.pinia ?? '')) {
  errors.push(`Console: pinia deve permanecer na linha 2.x compatível com o template atual; recebido ${packageDeps.pinia}.`);
}

for (const name of ['runtime-release.yml', 'sdk-build.yml', 'desktop-release.yml', 'mobile-release.yml', 'docker-publish.yml']) {
  const content = read(`.github/workflows/${name}`);
  if (!content.includes('release_tag:')) errors.push(`${name}: input release_tag ausente.`);
}

if (errors.length) {
  console.error('RELEASE_PIPELINE_INVALID');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('RELEASE_PIPELINE_OK release pós-merge, assets diretos, dispatch explícito, APP_KEY e dependências validados.');
