#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { envInt, ensureDir, log, parseCli, VERSION } from '../lib/utils.mjs';

const { positional, options } = parseCli(process.argv.slice(2));
const command = positional[0] || 'help';
const dataDir = path.resolve(String(options['data-dir'] || process.env.TUNNARA_DATA_DIR || path.join(process.cwd(), 'data')));
const storageDriver = String(process.env.TUNNARA_STORAGE_DRIVER || 'sqlite').trim().toLowerCase();
if (!['sqlite', 'memory'].includes(storageDriver)) {
  throw new Error(`TUNNARA_STORAGE_DRIVER inválido: ${storageDriver}. Use sqlite ou memory no runtime embarcado.`);
}
const dbFile = storageDriver === 'memory' ? ':memory:' : path.join(dataDir, 'tunnara.sqlite');
let db = null;

function help() {
  console.log(`Tunnara Server ${VERSION}\n\n` +
`Uso:\n` +
`  tunnara-server bootstrap --organization "Minha empresa" [--admin-token TOKEN]\n` +
`  tunnara-server serve-all [--data-dir ./data]\n` +
`  tunnara-server control | relay | edge\n` +
`  tunnara-server backup --output ./backup.sqlite\n` +
`  tunnara-server restore --input ./backup.sqlite --force\n` +
`  tunnara-server doctor [--data-dir ./data]\n\n` +
`Variáveis principais:\n` +
`  TUNNARA_STORAGE_DRIVER=sqlite|memory\n  TUNNARA_CONTROL_PORT=7100\n  TUNNARA_EDGE_PORT=7200\n  TUNNARA_RELAY_PORT=7300\n  TUNNARA_RELAY_EDGE_PORT=7301\n  TUNNARA_BASE_DOMAIN=tunnara.local\n`);
}

function validateSqliteFile(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(16);
    const bytes = fs.readSync(descriptor, header, 0, header.length, 0);
    return bytes === 16 && header.toString('utf8') === 'SQLite format 3\u0000';
  } finally { fs.closeSync(descriptor); }
}

function restoreDatabase() {
  const input = path.resolve(String(options.input || ''));
  if (!input || !fs.existsSync(input)) throw new Error('--input deve apontar para um backup SQLite existente.');
  if (!validateSqliteFile(input)) throw new Error('O arquivo informado não é um banco SQLite válido.');
  ensureDir(dataDir);
  if (fs.existsSync(dbFile) && !options.force) throw new Error(`O banco ${dbFile} já existe. Use --force para substituí-lo.`);
  if (fs.existsSync(dbFile)) {
    const previous = `${dbFile}.before-restore-${new Date().toISOString().replaceAll(':', '-')}`;
    fs.copyFileSync(dbFile, previous);
    console.log(`Cópia preventiva criada: ${previous}`);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${dbFile}${suffix}`, { force: true }); } catch {}
  }
  fs.copyFileSync(input, dbFile);
  try { fs.chmodSync(dbFile, 0o600); } catch {}
  console.log(JSON.stringify({ status: 'restored', input, database: dbFile }, null, 2));
}

async function start() {
  if (command === 'help' || options.help) { help(); return; }
  if (command === 'version' || options.version) { console.log(VERSION); return; }
  if (command === 'restore') {
    if (storageDriver === 'memory') throw new Error('Restore não está disponível com TUNNARA_STORAGE_DRIVER=memory.');
    restoreDatabase();
    return;
  }

  const [{ TunnaraDatabase }, { ControlServer, EdgeServer, RelayServer, TcpIngressManager, UdpIngressManager }, { ClusterControlClient, NodeRegistrar }] = await Promise.all([
    import('../lib/database.mjs'),
    import('../lib/server.mjs'),
    import('../lib/cluster.mjs'),
  ]);
  db = new TunnaraDatabase(dbFile);

  if (command === 'doctor') {
    const result = {
      status: 'ok', version: VERSION, storageDriver, dataDir, database: dbFile,
      databaseExists: storageDriver === 'memory' ? true : fs.existsSync(dbFile),
      organizationsInitialized: db.hasOrganizations(),
      ports: {
        control: envInt('TUNNARA_CONTROL_PORT', 7100), edge: envInt('TUNNARA_EDGE_PORT', 7200),
        relay: envInt('TUNNARA_RELAY_PORT', 7300), relayEdge: envInt('TUNNARA_RELAY_EDGE_PORT', 7301),
      },
    };
    console.log(JSON.stringify(result, null, 2));
    db.close(); return;
  }

  if (command === 'backup') {
    if (storageDriver === 'memory') throw new Error('Backup não está disponível com TUNNARA_STORAGE_DRIVER=memory.');
    const output = path.resolve(String(options.output || path.join(process.cwd(), `tunnara-backup-${Date.now()}.sqlite`)));
    ensureDir(path.dirname(output));
    if (fs.existsSync(output)) fs.rmSync(output);
    db.backup(output);
    try { fs.chmodSync(output, 0o600); } catch {}
    console.log(JSON.stringify({ status: 'backup_created', database: dbFile, output }, null, 2));
    db.close(); return;
  }

  if (command === 'bootstrap') {
    const organization = String(options.organization || 'Tunnara Community');
    const result = db.bootstrap(organization, String(options['admin-token'] || ''));
    if (!result.created) {
      console.error('A instalação já foi inicializada. Nenhum novo token foi exibido.');
      process.exitCode = 2;
    } else console.log(JSON.stringify({ organizationId: result.organizationId, adminToken: result.token }, null, 2));
    db.close(); return;
  }

  const autoToken = process.env.TUNNARA_BOOTSTRAP_ADMIN_TOKEN || '';
  const auto = db.bootstrap(process.env.TUNNARA_BOOTSTRAP_ORGANIZATION || 'Tunnara Community', autoToken);
  if (auto.created) {
    log('server', 'warn', 'Instalação inicializada automaticamente.', { organizationId: auto.organizationId });
    if (!autoToken) console.log(`TUNNARA_ADMIN_TOKEN=${auto.token}`);
  }

  const internalControlUrl = String(process.env.TUNNARA_INTERNAL_CONTROL_URL || '').replace(/\/$/, '');
  const clusterToken = String(process.env.TUNNARA_CLUSTER_TOKEN || '');
  const distributedControl = internalControlUrl && clusterToken
    ? new ClusterControlClient({ baseUrl: internalControlUrl, clusterToken, timeoutMs: envInt('TUNNARA_CLUSTER_TIMEOUT_MS', 10000) })
    : null;
  const region = process.env.TUNNARA_REGION || 'default';
  const nodeNamePrefix = process.env.TUNNARA_NODE_NAME || `tunnara-${process.pid}`;
  const relayEdgePublicUrl = process.env.TUNNARA_RELAY_EDGE_PUBLIC_URL || `tcp://${process.env.TUNNARA_RELAY_EDGE_ADVERTISE_HOST || '127.0.0.1'}:${envInt('TUNNARA_RELAY_EDGE_PORT', 7301)}`;

  const relay = new RelayServer({
    db,
    host: process.env.TUNNARA_RELAY_HOST || '0.0.0.0',
    agentPort: envInt('TUNNARA_RELAY_PORT', 7300),
    edgeHost: process.env.TUNNARA_RELAY_EDGE_HOST || '127.0.0.1',
    edgePort: envInt('TUNNARA_RELAY_EDGE_PORT', 7301),
    controlClient: distributedControl,
    publicEdgeUrl: relayEdgePublicUrl,
  });
  const control = new ControlServer({
    db,
    host: process.env.TUNNARA_CONTROL_HOST || '0.0.0.0',
    port: envInt('TUNNARA_CONTROL_PORT', 7100),
    relay,
    baseDomain: process.env.TUNNARA_BASE_DOMAIN || 'tunnara.local',
    publicScheme: process.env.TUNNARA_PUBLIC_SCHEME || (process.env.TUNNARA_EDGE_TLS_CERT || process.env.TUNNARA_BEHIND_TLS_PROXY === 'true' ? 'https' : 'http'),
    publicHost: process.env.TUNNARA_PUBLIC_EDGE_HOST || process.env.TUNNARA_BASE_DOMAIN || 'tunnara.local',
  });
  const edge = new EdgeServer({
    db,
    host: process.env.TUNNARA_EDGE_HOST || '0.0.0.0',
    port: envInt('TUNNARA_EDGE_PORT', 7200),
    relayHost: process.env.TUNNARA_RELAY_EDGE_HOST || '127.0.0.1',
    relayPort: envInt('TUNNARA_RELAY_EDGE_PORT', 7301),
    controlClient: distributedControl,
  });
  const tcpIngress = new TcpIngressManager({
    db,
    host: process.env.TUNNARA_TCP_EDGE_HOST || '0.0.0.0',
    relayHost: process.env.TUNNARA_RELAY_EDGE_HOST || '127.0.0.1',
    relayPort: envInt('TUNNARA_RELAY_EDGE_PORT', 7301),
    controlClient: distributedControl,
  });
  const udpIngress = new UdpIngressManager({
    db,
    host: process.env.TUNNARA_UDP_EDGE_HOST || '0.0.0.0',
    relayHost: process.env.TUNNARA_RELAY_EDGE_HOST || '127.0.0.1',
    relayPort: envInt('TUNNARA_RELAY_EDGE_PORT', 7301),
    idleTimeoutMs: envInt('TUNNARA_UDP_IDLE_TIMEOUT_MS', 60000),
    controlClient: distributedControl,
  });

  const services = command === 'serve-all' ? [relay, control, edge, tcpIngress, udpIngress]
    : command === 'relay' ? [relay]
      : command === 'control' ? [control]
        : command === 'edge' ? [edge, tcpIngress, udpIngress]
          : null;
  if (!services) { help(); db.close(); process.exitCode = 2; return; }
  for (const service of services) await service.start();
  const registrars = [];
  if (distributedControl && (command === 'relay' || command === 'edge')) {
    if (command === 'relay') {
      const registrar = new NodeRegistrar({
        client: distributedControl, nodeType: 'relay', name: `${nodeNamePrefix}-relay`, region,
        publicUrl: process.env.TUNNARA_PUBLIC_RELAY_URL || `tcp://${process.env.TUNNARA_RELAY_ADVERTISE_HOST || '127.0.0.1'}:${envInt('TUNNARA_RELAY_PORT', 7300)}`,
        internalUrl: relayEdgePublicUrl, transport: process.env.TUNNARA_RELAY_TRANSPORT || 'tcp',
        capacity: envInt('TUNNARA_RELAY_CAPACITY', 10000), activeConnections: () => relay.agents.size,
      });
      const node = await registrar.start(); relay.nodeId = node.id; registrars.push(registrar);
    }
    if (command === 'edge') {
      const registrar = new NodeRegistrar({
        client: distributedControl, nodeType: 'edge', name: `${nodeNamePrefix}-edge`, region,
        publicUrl: process.env.TUNNARA_PUBLIC_EDGE_URL || null,
        internalUrl: process.env.TUNNARA_EDGE_INTERNAL_URL || `http://${process.env.TUNNARA_EDGE_ADVERTISE_HOST || '127.0.0.1'}:${envInt('TUNNARA_EDGE_PORT', 7200)}`,
        transport: process.env.TUNNARA_EDGE_TRANSPORT || 'http3', capacity: envInt('TUNNARA_EDGE_CAPACITY', 10000),
      });
      await registrar.start(); registrars.push(registrar);
    }
  }
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('server', 'info', 'Encerrando serviços.', { signal });
    const hardStop = setTimeout(() => process.exit(1), 10_000).unref();
    for (const registrar of registrars) await registrar.stop();
    for (const service of [...services].reverse()) {
      await Promise.race([
        service.stop(),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
    try { db.close(); } catch {}
    clearTimeout(hardStop);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error) => {
  log('server', 'error', 'Falha fatal.', { error: error.stack || error.message });
  try { db?.close(); } catch {}
  process.exit(1);
});
