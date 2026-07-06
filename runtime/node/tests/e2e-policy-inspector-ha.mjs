#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-e2e-policy-'));
const dataDir = path.join(temp, 'data');
const configDir = path.join(temp, 'agent');
const adminToken = 'tnr_admin_policy_0123456789012345678901234567';
const controlUrl = 'http://127.0.0.1:25100';
const relayUrl = 'tcp://127.0.0.1:25300';
const edgePort = 25200;
const children = [];

function child(script, args, env = {}) {
  const proc = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, NODE_NO_WARNINGS: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (data) => process.stdout.write(`[child] ${data}`));
  proc.stderr.on('data', (data) => process.stderr.write(`[child:err] ${data}`));
  children.push(proc); return proc;
}

async function waitFor(url, options = {}, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url, options); if (response.ok) return response; } catch {}
    await sleep(150);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

function waitExit(proc, timeoutMs = 15000) {
  if (proc.exitCode !== null) return Promise.resolve(proc.exitCode);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Processo não encerrou.')), timeoutMs);
    proc.once('exit', (code) => { clearTimeout(timer); code === 0 ? resolve(code) : reject(new Error(`Processo encerrou com ${code}`)); });
  });
}

function createTarget(name, port) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/healthz') { res.writeHead(204); return res.end(); }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ target: name, path: req.url, policyHeader: req.headers['x-policy-applied'] || null, authorizationForwarded: Boolean(req.headers.authorization) }));
  });
  return { server, port, start: () => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve)), stop: () => new Promise((resolve) => server.close(resolve)) };
}

async function api(pathName, { method = 'GET', body, token = adminToken, headers = {} } = {}) {
  const response = await fetch(`${controlUrl}${pathName}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null; try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { response, payload };
}

async function edge(pathName, { authorization, method = 'GET', body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Host: 'policy.test.local' };
    if (authorization) headers.Authorization = authorization;
    if (body) { headers['content-type'] = 'text/plain'; headers['content-length'] = Buffer.byteLength(body); }
    const req = http.request({ host: '127.0.0.1', port: edgePort, method, path: pathName, headers }, (res) => {
      const chunks = []; res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.once('error', reject); if (body) req.write(body); req.end();
  });
}

const targetA = createTarget('A', 25080);
const targetB = createTarget('B', 25081);

try {
  await targetA.start();
  const server = child(path.join(root, 'runtime/node/bin/tunnara-server.mjs'), ['serve-all', '--data-dir', dataDir], {
    TUNNARA_CONTROL_PORT: '25100', TUNNARA_EDGE_PORT: String(edgePort), TUNNARA_RELAY_PORT: '25300', TUNNARA_RELAY_EDGE_PORT: '25301',
    TUNNARA_BASE_DOMAIN: 'test.local', TUNNARA_BOOTSTRAP_ADMIN_TOKEN: adminToken, TUNNARA_BOOTSTRAP_ORGANIZATION: 'Policy E2E',
    TUNNARA_PUBLIC_CONTROL_URL: controlUrl, TUNNARA_PUBLIC_RELAY_URL: relayUrl,
    TUNNARA_HEALTH_SCHEDULER_INTERVAL_MS: '500', TUNNARA_HEALTH_CHECK_CONCURRENCY: '4', TUNNARA_METRICS_PUBLIC: 'false',
    TUNNARA_REPLAY_EDGE_BASE_URL: `http://127.0.0.1:${edgePort}`,
  });
  await waitFor(`${controlUrl}/healthz`);

  const provision = await api('/api/v1/provisioning-tokens', { method: 'POST', body: { name: 'policy-agent', ttlSeconds: 600 } });
  assert.equal(provision.response.status, 201);
  const login = child(path.join(root, 'runtime/node/bin/tunnara.mjs'), ['login', '--token', provision.payload.token, '--name', 'policy-agent', '--control-url', controlUrl, '--relay-url', relayUrl, '--config-dir', configDir, '--json']);
  assert.equal(await waitExit(login), 0);
  const agentConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
  const agent = child(path.join(root, 'runtime/node/bin/tunnara.mjs'), ['serve', '--config-dir', configDir]);

  const policyCreated = await api('/api/v1/policies', {
    method: 'POST',
    body: {
      name: 'Proteção de produção',
      document: {
        defaultEffect: 'deny',
        rules: [
          { name: 'Health público', match: { pathPrefix: '/public' }, actions: [{ type: 'allow' }] },
          {
            name: 'Privado autenticado', match: { pathPrefix: '/private' },
            actions: [
              { type: 'basic_auth', realm: 'Tunnara', accounts: [{ username: 'wallace', password: 'secret-123' }] },
              { type: 'rate_limit', requests: 2, windowSeconds: 60 },
              { type: 'remove_request_headers', headers: ['authorization'] },
              { type: 'add_request_headers', headers: { 'x-policy-applied': 'yes' } },
              { type: 'rewrite_path', fromPrefix: '/private', toPrefix: '/api' },
              { type: 'add_response_headers', headers: { 'x-policy-result': 'allowed' } },
              { type: 'allow' },
            ],
          },
        ],
      },
    },
  });
  assert.equal(policyCreated.response.status, 201, JSON.stringify(policyCreated.payload));

  const tunnelCreated = await api('/api/v1/tunnels', {
    method: 'POST', headers: { 'Idempotency-Key': 'policy-ha-tunnel' },
    body: {
      name: 'Policy HA', protocol: 'http', hostname: 'policy.test.local', policyId: policyCreated.payload.id,
      inspectorEnabled: true, inspectorBodyLimit: 32768,
      targets: [
        { name: 'primary', agentId: agentConfig.agentId, targetHost: '127.0.0.1', targetPort: 25080, priority: 10, weight: 10, healthCheck: { type: 'http', path: '/healthz', intervalSeconds: 1, timeoutSeconds: 1, healthyThreshold: 1, unhealthyThreshold: 1 } },
        { name: 'secondary', agentId: agentConfig.agentId, targetHost: '127.0.0.1', targetPort: 25081, priority: 10, weight: 1, healthCheck: { type: 'http', path: '/healthz', intervalSeconds: 1, timeoutSeconds: 1, healthyThreshold: 1, unhealthyThreshold: 1 } },
      ],
    },
  });
  assert.equal(tunnelCreated.response.status, 201, JSON.stringify(tunnelCreated.payload));
  assert.equal(tunnelCreated.payload.targets.length, 2);

  await waitFor(`${controlUrl}/api/v1/agents`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const deadline = Date.now() + 12000;
  let targets = [];
  while (Date.now() < deadline) {
    const result = await api(`/api/v1/tunnels/${tunnelCreated.payload.id}/targets`);
    targets = result.payload.data;
    if (targets.some((target) => target.name === 'primary' && target.healthStatus === 'healthy') && targets.some((target) => target.name === 'secondary' && target.healthStatus === 'unhealthy')) break;
    await sleep(300);
  }
  assert.equal(targets.find((target) => target.name === 'primary')?.healthStatus, 'healthy');
  assert.equal(targets.find((target) => target.name === 'secondary')?.healthStatus, 'unhealthy');

  const denied = await edge('/private/test');
  assert.equal(denied.status, 401);
  assert.match(String(denied.headers['www-authenticate']), /Basic/);

  const authorization = `Basic ${Buffer.from('wallace:secret-123').toString('base64')}`;
  const first = await edge('/private/test?x=1', { authorization });
  assert.equal(first.status, 200, first.body);
  assert.equal(first.headers['x-policy-result'], 'allowed');
  const firstPayload = JSON.parse(first.body);
  assert.equal(firstPayload.target, 'A');
  assert.equal(firstPayload.path, '/api/test?x=1');
  assert.equal(firstPayload.policyHeader, 'yes');
  assert.equal(firstPayload.authorizationForwarded, false);
  assert.equal((await edge('/private/test', { authorization })).status, 200);
  assert.equal((await edge('/private/test', { authorization })).status, 429);

  const publicRequest = await edge('/public/replay');
  assert.equal(publicRequest.status, 200);
  const inspections = await api(`/api/v1/inspections?tunnelId=${tunnelCreated.payload.id}&limit=20`);
  assert.equal(inspections.response.status, 200);
  assert.ok(inspections.payload.data.length >= 4);
  const replayable = inspections.payload.data.find((entry) => entry.path === '/public/replay');
  assert.ok(replayable);
  const replay = await api(`/api/v1/inspections/${replayable.id}/replay`, { method: 'POST' });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.status, 200);

  const metricsResponse = await fetch(`${controlUrl}/metrics`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(metricsResponse.status, 200);
  const metricText = await metricsResponse.text();
  assert.match(metricText, /tunnara_http_requests_total/);
  assert.match(metricText, /tunnara_policy_decisions_total/);

  await targetA.stop();
  await targetB.start();
  const failoverDeadline = Date.now() + 12000;
  let failoverResponse = null;
  while (Date.now() < failoverDeadline) {
    try {
      failoverResponse = await edge('/public/failover');
      if (failoverResponse.status === 200 && JSON.parse(failoverResponse.body).target === 'B') break;
    } catch {}
    await sleep(400);
  }
  assert.equal(failoverResponse?.status, 200, failoverResponse?.body);
  assert.equal(JSON.parse(failoverResponse.body).target, 'B');

  console.log('E2E_OK policy engine, Basic Auth, rate limit, transformações, inspector/replay, métricas, health checks e failover de targets validados.');
  agent.kill('SIGTERM'); server.kill('SIGTERM');
  await Promise.all([waitExit(agent), waitExit(server)]);
} finally {
  for (const proc of children) if (proc.exitCode === null) proc.kill('SIGKILL');
  try { await targetA.stop(); } catch {}
  try { await targetB.stop(); } catch {}
  fs.rmSync(temp, { recursive: true, force: true });
}
