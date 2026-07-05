import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md',
  '.gitignore', '.gitattributes', '.github/workflows/ci.yml', '.github/workflows/release.yml',
  'runtime/node/bin/tunnara.mjs', 'runtime/node/bin/tunnara-server.mjs',
  'deploy/docker/docker-compose.yml', 'deploy/docker/storage/storage.sh',
  'docs/operations/STORAGE_PROVIDERS.md', 'docs/operations/GITHUB_ACTIONS.md', 'docs/operations/POST_MERGE_RELEASE.md', 'VERSION',
];
const forbiddenNames = new Set(['.env', 'tunnara.sqlite', 'tunnara.sqlite-wal', 'tunnara.sqlite-shm']);
const forbiddenDirs = new Set(['node_modules', 'vendor', 'target', '.build', 'artifacts', 'dist', 'data', 'backups', 'runtime-data', 'agent-data']);
const findings = [];

for (const file of required) if (!fs.existsSync(path.join(root, file))) findings.push(`Arquivo obrigatório ausente: ${file}`);

function walk(dir, relative = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (forbiddenDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name), rel);
    } else {
      if (forbiddenNames.has(entry.name) || /^\.env(?:\..+)?$/.test(entry.name) && !['.env.example', '.env.model'].includes(entry.name)) findings.push(`Arquivo operacional/segredo não deve ser versionado: ${rel}`);
      if (/\.(sqlite(?:-wal|-shm)?|db)$/i.test(entry.name)) findings.push(`Banco ou estado local não deve ser versionado: ${rel}`);
      if (/\.(pem|key|p12|pfx|jks|keystore|mobileprovision)$/i.test(entry.name) && !entry.name.endsWith('.example')) findings.push(`Material criptográfico não deve ser versionado: ${rel}`);
      if (/\.(ipa|aab)$/i.test(entry.name)) findings.push(`Artefato mobile gerado não deve ser versionado: ${rel}`);
      if (entry.name.endsWith('.log')) findings.push(`Log local não deve ser versionado: ${rel}`);
    }
  }
}
walk(root);

if (fs.existsSync(path.join(root, '.git'))) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8').split('\0').filter(Boolean);
  for (const rel of tracked) {
    const parts = rel.split('/');
    if (parts.some((part) => forbiddenDirs.has(part)) || forbiddenNames.has(parts.at(-1))) {
      findings.push(`Arquivo gerado/operacional está versionado: ${rel}`);
    }
  }
}


const lockfiles = ['package-lock.json', 'apps/console/package-lock.json'];
for (const rel of lockfiles) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (/applied-caas-gateway|internal\.api\.openai\.org/i.test(content)) {
    findings.push(`Lockfile contém registry interno não acessível pelo GitHub Actions: ${rel}`);
  }
}

const workflowsDir = path.join(root, '.github', 'workflows');
if (fs.existsSync(workflowsDir)) {
  for (const name of fs.readdirSync(workflowsDir)) {
    if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
    const rel = path.join('.github', 'workflows', name);
    const content = fs.readFileSync(path.join(workflowsDir, name), 'utf8');
    if (/macos-13/.test(content)) findings.push(`Runner removido ainda referenciado: ${rel}`);
    const runsOnPullRequest = /(^|\n)\s*pull_request\s*:/m.test(content);
    if (runsOnPullRequest && /actions\/(?:upload|download)-artifact@/i.test(content)) {
      findings.push(`Workflow de pull request não pode criar/baixar artifacts: ${rel}`);
    }
  }
}

const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) findings.push(`VERSION não é SemVer: ${version}`);

if (findings.length) {
  console.error('Repositório não está pronto para publicação:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`REPOSITORY_OK Tunnara ${version}: estrutura limpa e pronta para GitHub.`);
