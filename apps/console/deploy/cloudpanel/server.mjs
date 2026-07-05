import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(rootDir, '.env');

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(envFile);

const binPath = resolve(rootDir, process.env.TUNNARA_CONSOLE_BINARY || './bin/tunnara_console');
const dataDir = resolve(rootDir, process.env.TUNNARA_CONSOLE_DATA_DIR || './data');
const logsDir = resolve(rootDir, process.env.TUNNARA_CONSOLE_LOGS_DIR || './logs');
const distDir = resolve(rootDir, process.env.TUNNARA_CONSOLE_WEB_DIST_DIR || './dist');

mkdirSync(dataDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

if (!existsSync(binPath)) {
  console.error(`[cloudpanel] Binário não encontrado: ${binPath}`);
  console.error('[cloudpanel] Gere o release Linux com scripts/linux/build-cloudpanel-release.sh antes do deploy.');
  process.exit(1);
}

if (!existsSync(resolve(distDir, 'index.html'))) {
  console.error(`[cloudpanel] Frontend dist não encontrado em: ${distDir}`);
  console.error('[cloudpanel] Execute npm run build:web antes de empacotar ou copie a pasta dist para o release.');
  process.exit(1);
}

const apiHost = process.env.TUNNARA_CONSOLE_API_HOST || '127.0.0.1';
const apiPort = process.env.TUNNARA_CONSOLE_API_PORT || '61001';

// CloudPanel normalmente injeta PORT para a aplicação Node.js.
// Aqui essa porta vira a porta pública local do WebPort/proxy Rust.
const webPort = process.env.PORT || process.env.TUNNARA_CONSOLE_WEB_PORT || '61002';
const webHost = process.env.TUNNARA_CONSOLE_WEB_HOST || '127.0.0.1';

process.env.TUNNARA_CONSOLE_ENV_FILE = process.env.TUNNARA_CONSOLE_ENV_FILE || envFile;
process.env.TUNNARA_CONSOLE_WEB_DIST_DIR = distDir;
process.env.TUNNARA_CONSOLE_API_HOST = apiHost;
process.env.TUNNARA_CONSOLE_API_PORT = apiPort;
process.env.TUNNARA_CONSOLE_API_BASE_URL = process.env.TUNNARA_CONSOLE_API_BASE_URL || `http://${apiHost}:${apiPort}`;
process.env.TUNNARA_CONSOLE_WEB_HOST = webHost;
process.env.TUNNARA_CONSOLE_WEB_PORT = webPort;
process.env.TUNNARA_CONSOLE_WEB_ENABLED = process.env.TUNNARA_CONSOLE_WEB_ENABLED || 'true';
process.env.TUNNARA_CONSOLE_WEB_AUTO_START = process.env.TUNNARA_CONSOLE_WEB_AUTO_START || 'true';
process.env.TUNNARA_CONSOLE_SERVICES_AUTO_START = process.env.TUNNARA_CONSOLE_SERVICES_AUTO_START || 'true';

const args = [
  '--mode=headless-api',
  '--host', apiHost,
  '--port', String(apiPort),
  '--data-dir', dataDir,
  '--start-web-proxy',
  '--start-services'
];

if (process.env.TUNNARA_CONSOLE_WEBHOOK_ENABLED === 'true') {
  args.push('--start-webhook');
}

if (process.env.TUNNARA_CONSOLE_WEBSOCKET_ENABLED === 'true') {
  args.push('--start-websocket');
}

console.log(`[cloudpanel] Iniciando ${binPath}`);
console.log(`[cloudpanel] WebPort: http://${webHost}:${webPort}`);
console.log(`[cloudpanel] API interna: http://${apiHost}:${apiPort}`);
console.log(`[cloudpanel] Data dir: ${dataDir}`);

const child = spawn(binPath, args, {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit'
});

function shutdown(signal) {
  if (!child.killed) {
    child.kill(signal);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[cloudpanel] Processo encerrado por sinal: ${signal}`);
    process.exit(128);
  }
  process.exit(code ?? 0);
});
