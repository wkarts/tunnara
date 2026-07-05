import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import dgram from 'node:dgram';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const serverBin = path.join(root, 'runtime/node/bin/tunnara-server.mjs');
const agentBin = path.join(root, 'runtime/node/bin/tunnara.mjs');

function spawnNode(args, env = {}) {
  const child = childProcess.spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`# [child] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`# [child] ${chunk}`));
  return child;
}

async function waitHttp(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

async function json(url, { method = 'GET', token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  return payload;
}

function tcpRoundTrip(port, message) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const chunks = [];
    socket.once('connect', () => socket.write(message));
    socket.on('data', (chunk) => { chunks.push(chunk); socket.end(); });
    socket.once('close', () => resolve(Buffer.concat(chunks).toString()));
    socket.once('error', reject);
  });
}

function udpRoundTrip(port, message) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => { socket.close(); reject(new Error('Timeout UDP')); }, 5000);
    socket.once('message', (data) => { clearTimeout(timer); socket.close(); resolve(data.toString()); });
    socket.once('error', reject);
    socket.send(Buffer.from(message), port, '127.0.0.1');
  });
}

test('túneis TCP e UDP atravessam Edge -> Relay -> Agent', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-e2e-net-'));
  const dataDir = path.join(temp, 'data');
  const configDir = path.join(temp, 'agent');
  const ports = { control: 21100, edge: 21200, relay: 21300, relayEdge: 21301, tcpTarget: 21400, udpTarget: 21401, tcpPublic: 21500, udpPublic: 21501 };
  const adminToken = 'tnr_admin_test_tcp_udp';
  const tcpEcho = net.createServer((socket) => socket.pipe(socket));
  await new Promise((resolve) => tcpEcho.listen(ports.tcpTarget, '127.0.0.1', resolve));
  const udpEcho = dgram.createSocket('udp4');
  udpEcho.on('message', (message, remote) => udpEcho.send(message, remote.port, remote.address));
  await new Promise((resolve) => udpEcho.bind(ports.udpTarget, '127.0.0.1', resolve));

  const env = {
    TUNNARA_DATA_DIR: dataDir,
    TUNNARA_BOOTSTRAP_ADMIN_TOKEN: adminToken,
    TUNNARA_CONTROL_PORT: String(ports.control),
    TUNNARA_EDGE_PORT: String(ports.edge),
    TUNNARA_RELAY_PORT: String(ports.relay),
    TUNNARA_RELAY_EDGE_PORT: String(ports.relayEdge),
    TUNNARA_PUBLIC_RELAY_URL: `tcp://127.0.0.1:${ports.relay}`,
    TUNNARA_PUBLIC_CONTROL_URL: `http://127.0.0.1:${ports.control}`,
    TUNNARA_PUBLIC_PORT_MIN: '21500',
    TUNNARA_PUBLIC_PORT_MAX: '21520',
  };
  const server = spawnNode([serverBin, 'serve-all'], env);
  let agent;
  try {
    await waitHttp(`http://127.0.0.1:${ports.control}/healthz`);
    const provision = await json(`http://127.0.0.1:${ports.control}/api/v1/provisioning-tokens`, {
      method: 'POST', token: adminToken, body: { name: 'net-agent' },
    });
    const login = spawnNode([agentBin, 'login', '--token', provision.token, '--name', 'net-agent', '--control-url', `http://127.0.0.1:${ports.control}`, '--config-dir', configDir]);
    assert.equal(await new Promise((resolve) => login.once('exit', resolve)), 0);
    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
    agent = spawnNode([agentBin, 'serve', '--config-dir', configDir, '--no-local-api'], env);
    await sleep(400);
    const tcpTunnel = await json(`http://127.0.0.1:${ports.control}/api/v1/tunnels`, {
      method: 'POST', token: config.sessionToken,
      body: { protocol: 'tcp', targetHost: '127.0.0.1', targetPort: ports.tcpTarget, publicPort: ports.tcpPublic, name: 'TCP echo' },
    });
    const udpTunnel = await json(`http://127.0.0.1:${ports.control}/api/v1/tunnels`, {
      method: 'POST', token: config.sessionToken,
      body: { protocol: 'udp', targetHost: '127.0.0.1', targetPort: ports.udpTarget, publicPort: ports.udpPublic, name: 'UDP echo' },
    });
    assert.equal(tcpTunnel.publicPort, ports.tcpPublic);
    assert.equal(udpTunnel.publicPort, ports.udpPublic);
    await sleep(2500);
    assert.equal(await tcpRoundTrip(ports.tcpPublic, 'tcp-ok'), 'tcp-ok');
    assert.equal(await udpRoundTrip(ports.udpPublic, 'udp-ok'), 'udp-ok');
    console.log('E2E_OK TCP e UDP validados.');
  } finally {
    agent?.kill('SIGTERM');
    server.kill('SIGTERM');
    tcpEcho.close(); udpEcho.close();
    await sleep(300);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
