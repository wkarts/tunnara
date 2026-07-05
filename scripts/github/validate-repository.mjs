import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md',
  '.gitignore', '.gitattributes', '.github/workflows/ci.yml', '.github/workflows/release.yml',
  'runtime/node/bin/tunnara.mjs', 'runtime/node/bin/tunnara-server.mjs',
  'deploy/docker/docker-compose.yml', 'VERSION',
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

const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) findings.push(`VERSION não é SemVer: ${version}`);

if (findings.length) {
  console.error('Repositório não está pronto para publicação:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`REPOSITORY_OK Tunnara ${version}: estrutura limpa e pronta para GitHub.`);
