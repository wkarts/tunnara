#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { FramedConnection, onceFrame } from '../lib/framing.mjs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-e2e-'));
const dataDir = path.join(temp, 'data');
const configDir = path.join(temp, 'agent');
const adminToken = 'tnr_admin_e2e_012345678901234567890123456789';
const controlUrl = 'http://127.0.0.1:19100';
const relayUrl = 'tcp://127.0.0.1:19300';
const edgePort = 19200;
const children = [];
const targetSockets = new Set();

function child(script, args, env = {}) {
  const isAgent = script.endsWith(`${path.sep}tunnara.mjs`);
  const standalone = isAgent ? process.env.TUNNARA_E2E_AGENT_BIN : process.env.TUNNARA_E2E_SERVER_BIN;
  const command = standalone ? path.resolve(standalone) : process.execPath;
  const commandArgs = standalone ? args : [script, ...args];
  const processChild = spawn(command, commandArgs, {
    cwd: root,
    env: { ...process.env, NODE_NO_WARNINGS: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processChild.stdout.on('data', (data) => process.stdout.write(`[child] ${data}`));
  processChild.stderr.on('data', (data) => process.stderr.write(`[child:err] ${data}`));
  children.push(processChild);
  return processChild;
}

async function waitFor(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await sleep(150);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

function waitExit(proc, timeoutMs = 15000, label = 'processo') {
  if (proc.exitCode !== null) return proc.exitCode === 0 ? Promise.resolve(proc.exitCode) : Promise.reject(new Error(`Processo encerrou com código ${proc.exitCode}`));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} não encerrou no tempo esperado.`)), timeoutMs);
    proc.once('exit', (code) => { clearTimeout(timer); code === 0 ? resolve(code) : reject(new Error(`Processo encerrou com código ${code}`)); });
  });
}

async function assertInvalidAgentProof(agentConfig) {
  const socket = net.connect({ host: '127.0.0.1', port: 19300 });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  const connection = new FramedConnection(socket);
  connection.send({
    type: 'agent_hello',
    agentId: agentConfig.agentId,
    sessionToken: agentConfig.sessionToken,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    nonce: 'invalid_nonce_12345678901234567890',
    proof: Buffer.from('invalid').toString('base64'),
  });
  const frame = await onceFrame(connection, 5000);
  assert.equal(frame.type, 'error');
  assert.equal(frame.code, 'AGENT_PROOF_INVALID');
  connection.destroy();
}

async function edgeRequest({ method = 'GET', pathName = '/', body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: edgePort, method, path: pathName,
      headers: { Host: 'demo.test.local', 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const target = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, method: req.method, path: req.url, body, forwardedHost: req.headers['x-forwarded-host'] }));
});

target.on('connection', (socket) => { targetSockets.add(socket); socket.on('close', () => targetSockets.delete(socket)); });

target.on('upgrade', (req, socket, head) => {
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  if (head.length) socket.write(head);
  socket.on('data', (chunk) => socket.write(chunk));
});

async function rawUpgradeEcho() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port: edgePort });
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Timeout no teste de upgrade.')); }, 10000);
    socket.once('connect', () => {
      socket.write('GET /socket HTTP/1.1\r\nHost: demo.test.local\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGVzdA==\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const split = buffer.indexOf('\r\n\r\n');
        if (split < 0) return;
        const headers = buffer.subarray(0, split + 4).toString('utf8');
        if (!headers.startsWith('HTTP/1.1 101')) return reject(new Error(`Upgrade recusado: ${headers}`));
        upgraded = true;
        buffer = buffer.subarray(split + 4);
        socket.write('PING_TUNNARA');
      }
      if (upgraded && buffer.includes(Buffer.from('PING_TUNNARA'))) {
        clearTimeout(timer); socket.destroy(); resolve();
      }
    });
    socket.on('error', reject);
  });
}

try {
  await new Promise((resolve) => target.listen(19080, '127.0.0.1', resolve));
  const server = child(path.join(root, 'runtime/node/bin/tunnara-server.mjs'), ['serve-all', '--data-dir', dataDir], {
    TUNNARA_CONTROL_PORT: '19100', TUNNARA_EDGE_PORT: String(edgePort), TUNNARA_RELAY_PORT: '19300',
    TUNNARA_RELAY_EDGE_PORT: '19301', TUNNARA_BASE_DOMAIN: 'test.local',
    TUNNARA_BOOTSTRAP_ADMIN_TOKEN: adminToken, TUNNARA_BOOTSTRAP_ORGANIZATION: 'E2E',
    TUNNARA_PUBLIC_CONTROL_URL: controlUrl, TUNNARA_PUBLIC_RELAY_URL: relayUrl,
  });
  await waitFor(`${controlUrl}/healthz`);

  const sessionResponse = await fetch(`${controlUrl}/api/v1/session`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  assert.equal(session.authenticated, true);
  assert.equal(session.organizationName, 'E2E');


  const tokenCreateResponse = await fetch(`${controlUrl}/api/v1/api-tokens`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Somente leitura de túneis', scopes: ['tunnels:read'] }),
  });
  assert.equal(tokenCreateResponse.status, 201);
  const limitedToken = await tokenCreateResponse.json();
  assert.match(limitedToken.token, /^tnr_admin_/);
  const limitedTunnels = await fetch(`${controlUrl}/api/v1/tunnels`, { headers: { Authorization: `Bearer ${limitedToken.token}` } });
  assert.equal(limitedTunnels.status, 200);
  const forbiddenAgents = await fetch(`${controlUrl}/api/v1/agents`, { headers: { Authorization: `Bearer ${limitedToken.token}` } });
  assert.equal(forbiddenAgents.status, 403);

  const provisionResponse = await fetch(`${controlUrl}/api/v1/provisioning-tokens`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Agente E2E', ttlSeconds: 600 }),
  });
  assert.equal(provisionResponse.status, 201);
  const provision = await provisionResponse.json();
  assert.match(provision.token, /^tnr_prov_/);

  const login = child(path.join(root, 'runtime/node/bin/tunnara.mjs'), [
    'login', '--token', provision.token, '--name', 'agent-e2e', '--control-url', controlUrl,
    '--relay-url', relayUrl, '--config-dir', configDir, '--json',
  ]);
  await waitExit(login);

  const agentConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
  const reusedProvision = await fetch(`${controlUrl}/api/v1/agents/register`, {
    method: 'POST',
    headers: { 'X-Tunnara-Provisioning-Token': provision.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'reuse-denied', platform: process.platform, architecture: process.arch, version: '1.0.0', publicKey: agentConfig.publicKey }),
  });
  assert.equal(reusedProvision.status, 401);
  await assertInvalidAgentProof(agentConfig);

  const agent = child(path.join(root, 'runtime/node/bin/tunnara.mjs'), [
    'http', '19080', '--domain', 'demo.test.local', '--name', 'E2E HTTP', '--config-dir', configDir,
  ]);

  const deadline = Date.now() + 15000;
  let response;
  while (Date.now() < deadline) {
    try {
      response = await edgeRequest({ method: 'POST', pathName: '/hello?from=e2e', body: 'tunnara-real' });
      if (response.status === 200) break;
    } catch {}
    await sleep(200);
  }
  assert.equal(response?.status, 200, response?.body);
  const payload = JSON.parse(response.body);
  assert.deepEqual(payload, {
    ok: true, method: 'POST', path: '/hello?from=e2e', body: 'tunnara-real', forwardedHost: 'demo.test.local',
  });
  assert.ok(response.headers['x-tunnara-tunnel-id']);

  await rawUpgradeEcho();

  const overviewResponse = await fetch(`${controlUrl}/api/v1/overview`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const overview = await overviewResponse.json();
  assert.equal(overview.agentsOnline, 1);
  assert.equal(overview.tunnelsActive, 1);

  const revokeResponse = await fetch(`${controlUrl}/api/v1/agents/${agentConfig.agentId}/revoke`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(revokeResponse.status, 200);
  await sleep(250);
  const revokedRequest = await edgeRequest();
  assert.equal(revokedRequest.status, 503);


  const tokenRevokeResponse = await fetch(`${controlUrl}/api/v1/api-tokens/${limitedToken.id}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(tokenRevokeResponse.status, 204);
  const revokedTokenRequest = await fetch(`${controlUrl}/api/v1/tunnels`, { headers: { Authorization: `Bearer ${limitedToken.token}` } });
  assert.equal(revokedTokenRequest.status, 401);

  console.log('\nE2E_OK HTTP, Upgrade/WebSocket, prova Ed25519, escopos, backup/restore, token descartável e revogação validados.');
  agent.kill('SIGTERM');
  server.kill('SIGTERM');
  await Promise.all([waitExit(agent, 15000, 'agent'), waitExit(server, 15000, 'server')]);

  const backupFile = path.join(temp, 'backup.sqlite');
  const backup = child(path.join(root, 'runtime/node/bin/tunnara-server.mjs'), ['backup', '--data-dir', dataDir, '--output', backupFile]);
  await waitExit(backup);
  assert.equal(fs.existsSync(backupFile), true);
  const restoredDataDir = path.join(temp, 'restored-data');
  const restore = child(path.join(root, 'runtime/node/bin/tunnara-server.mjs'), ['restore', '--data-dir', restoredDataDir, '--input', backupFile, '--force']);
  await waitExit(restore);
  const doctor = child(path.join(root, 'runtime/node/bin/tunnara-server.mjs'), ['doctor', '--data-dir', restoredDataDir]);
  await waitExit(doctor);
} finally {
  for (const proc of children) { if (proc.exitCode === null) proc.kill('SIGKILL'); }
  for (const socket of targetSockets) socket.destroy();
  target.closeAllConnections?.();
  target.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
