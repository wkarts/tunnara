import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { build as esbuildBuild } from 'esbuild';

const root = process.cwd();
const entries = [
  'runtime/node/bin/tunnara.mjs',
  'runtime/node/bin/tunnara-server.mjs',
];

for (const relative of entries) {
  const entry = path.join(root, relative);
  if (!fs.existsSync(entry)) {
    throw new Error(`Entrada SEA ausente: ${relative}`);
  }

  const result = await esbuildBuild({
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    banner: {
      js: 'globalThis.__TUNNARA_SEA__=true;',
    },
    write: false,
    logLevel: 'silent',
  });

  const output = result.outputFiles?.[0]?.contents;
  if (!output || output.length < 100) {
    throw new Error(`Bundle SEA inválido ou vazio para ${relative}`);
  }
}

const builder = fs.readFileSync(path.join(root, 'scripts/release/build-sea.mjs'), 'utf8');
if (/run\(process\.execPath,\s*\[esbuild/.test(builder)) {
  throw new Error('build-sea.mjs não pode executar o binário nativo do esbuild como um script Node.js.');
}
if (!/from ['"]esbuild['"]/.test(builder) || !/await esbuildBuild\(/.test(builder)) {
  throw new Error('build-sea.mjs deve utilizar a API JavaScript oficial do esbuild.');
}

console.log('SEA_BUILDER_OK API do esbuild validada para Agent e Server sem gerar artefatos persistentes.');
