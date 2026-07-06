import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const kind = process.argv[2];
const outputArg = process.argv[3];
if (!['agent', 'server'].includes(kind) || !outputArg) {
  console.error('Uso: node scripts/release/build-sea.mjs <agent|server> <arquivo-saida>');
  process.exit(2);
}

const root = process.cwd();
const entry = kind === 'agent' ? 'runtime/node/bin/tunnara.mjs' : 'runtime/node/bin/tunnara-server.mjs';
const output = path.resolve(outputArg + (process.platform === 'win32' && !outputArg.endsWith('.exe') ? '.exe' : ''));
const work = path.join(root, '.build', `sea-${kind}-${process.platform}-${process.arch}`);
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const bundle = path.join(work, `${kind}.cjs`);
const blob = path.join(work, `${kind}.blob`);
const config = path.join(work, 'sea-config.json');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.status !== 0) throw new Error(`${command} encerrou com código ${result.status}`);
}

const esbuild = process.env.ESBUILD_CLI || path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
if (!fs.existsSync(esbuild)) throw new Error(`CLI JavaScript do esbuild não encontrado em ${esbuild}. Execute npm ci na raiz.`);
run(process.execPath, [esbuild, entry, '--bundle', '--platform=node', '--target=node22', '--format=cjs', `--outfile=${bundle}`, '--banner:js=globalThis.__TUNNARA_SEA__=true;']);

fs.writeFileSync(config, JSON.stringify({
  main: bundle,
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
}, null, 2));
run(process.execPath, ['--experimental-sea-config', config]);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(process.execPath, output);

const postject = process.env.POSTJECT_CLI || path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');
if (!fs.existsSync(postject)) throw new Error(`CLI JavaScript do postject não encontrado em ${postject}. Execute npm ci na raiz.`);
const injectArgs = [output, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') injectArgs.push('--macho-segment-name', 'NODE_SEA');
run(process.execPath, [postject, ...injectArgs]);
if (process.platform !== 'win32') fs.chmodSync(output, 0o755);
if (process.platform === 'darwin') run('codesign', ['--sign', '-', '--force', output]);
console.log(`Executável SEA criado: ${output}`);
