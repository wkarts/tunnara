import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
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
async function waitHttp(url) { for (let i = 0; i < 100; i += 1) { try { const r = await fetch(url); if (r.ok) return; } catch {} await sleep(50); } throw new Error('timeout'); }
async function json(url, { method = 'GET', token, body } = {}) {
  const response = await fetch(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  return payload;
}

function mockCloudflare(port) {
  const records = new Map(); let counter = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const send = (status, payload) => { const data = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'content-type': 'application/json', 'content-length': data.length }); res.end(data); };
    if (req.headers.authorization !== 'Bearer cf_test_token') return send(403, { success: false, errors: [{ message: 'bad token' }] });
    if (url.pathname === '/user/tokens/verify') return send(200, { success: true, result: { status: 'active' } });
    if (url.pathname === '/zones') return send(200, { success: true, result: [{ id: 'zone-1', name: 'example.test' }] });
    if (url.pathname === '/zones/zone-1/dns_records' && req.method === 'GET') {
      const name = url.searchParams.get('name'); const type = url.searchParams.get('type');
      return send(200, { success: true, result: [...records.values()].filter((r) => (!name || r.name === name) && (!type || r.type === type)) });
    }
    if (url.pathname === '/zones/zone-1/dns_records' && req.method === 'POST') {
      const record = { id: `rec-${++counter}`, ...body }; records.set(record.id, record); return send(200, { success: true, result: record });
    }
    const match = url.pathname.match(/^\/zones\/zone-1\/dns_records\/(.+)$/);
    if (match && req.method === 'PATCH') { const record = { ...records.get(match[1]), ...body, id: match[1] }; records.set(match[1], record); return send(200, { success: true, result: record }); }
    if (match && req.method === 'DELETE') { records.delete(match[1]); return send(200, { success: true, result: { id: match[1] } }); }
    return send(404, { success: false, errors: [{ message: 'not found' }] });
  });
  return { server, records, start: () => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve)), stop: () => new Promise((resolve) => server.close(resolve)) };
}

test('Cloudflare DNS e bootstrap wildcard são gerenciados pela Control API', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-e2e-cf-'));
  const configDir = path.join(temp, 'agent');
  const ports = { control: 22100, edge: 22200, relay: 22300, relayEdge: 22301, cloudflare: 22400 };
  const adminToken = 'tnr_admin_cloudflare_test';
  const cf = mockCloudflare(ports.cloudflare); await cf.start();
  const env = {
    TUNNARA_DATA_DIR: path.join(temp, 'data'), TUNNARA_BOOTSTRAP_ADMIN_TOKEN: adminToken,
    TUNNARA_CONTROL_PORT: String(ports.control), TUNNARA_EDGE_PORT: String(ports.edge),
    TUNNARA_RELAY_PORT: String(ports.relay), TUNNARA_RELAY_EDGE_PORT: String(ports.relayEdge),
    TUNNARA_PUBLIC_RELAY_URL: `tcp://127.0.0.1:${ports.relay}`,
    TUNNARA_PUBLIC_CONTROL_URL: `http://127.0.0.1:${ports.control}`,
    TUNNARA_BASE_DOMAIN: 'tunnel.example.test', TUNNARA_AUTO_DNS: 'true',
    TUNNARA_MASTER_KEY_BASE64: crypto.randomBytes(32).toString('base64'),
  };
  const server = spawnNode([serverBin, 'serve-all'], env);
  try {
    await waitHttp(`http://127.0.0.1:${ports.control}/healthz`);
    const configured = await json(`http://127.0.0.1:${ports.control}/api/v1/integrations/cloudflare`, {
      method: 'PUT', token: adminToken, body: {
        zoneName: 'example.test', managedDomain: 'tunnel.example.test', apiToken: 'cf_test_token', edgeAddress: '203.0.113.10',
        apiBaseUrl: `http://127.0.0.1:${ports.cloudflare}`, dnsMode: 'wildcard', acmeEmail: 'ops@example.test',
      },
    });
    assert.equal(configured.provider, 'cloudflare'); assert.equal(configured.hasSecret, true);
    const verified = await json(`http://127.0.0.1:${ports.control}/api/v1/integrations/cloudflare/test`, { method: 'POST', token: adminToken });
    assert.equal(verified.zoneId, 'zone-1');
    const boot = await json(`http://127.0.0.1:${ports.control}/api/v1/integrations/cloudflare/bootstrap-dns`, { method: 'POST', token: adminToken });
    assert.equal(boot.records.length, 5);
    assert.ok([...cf.records.values()].some((r) => r.name === '*.tunnel.example.test'));

    const provision = await json(`http://127.0.0.1:${ports.control}/api/v1/provisioning-tokens`, { method: 'POST', token: adminToken, body: { name: 'cf-agent' } });
    const login = spawnNode([agentBin, 'login', '--token', provision.token, '--name', 'cf-agent', '--control-url', `http://127.0.0.1:${ports.control}`, '--config-dir', configDir], env);
    assert.equal(await new Promise((resolve) => login.once('exit', resolve)), 0);
    const cfg = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
    const tunnel = await json(`http://127.0.0.1:${ports.control}/api/v1/tunnels`, {
      method: 'POST', token: cfg.sessionToken,
      body: { protocol: 'http', targetPort: 8080, hostname: 'app.tunnel.example.test', autoDns: true },
    });
    assert.equal(tunnel.hostname, 'app.tunnel.example.test');
    assert.ok([...cf.records.values()].some((r) => r.name === 'app.tunnel.example.test'));
    await json(`http://127.0.0.1:${ports.control}/api/v1/tunnels/${tunnel.id}`, { method: 'DELETE', token: cfg.sessionToken });
    assert.ok(![...cf.records.values()].some((r) => r.name === 'app.tunnel.example.test'));
    console.log('E2E_OK Cloudflare DNS, wildcard e lifecycle do subdomínio validados.');
  } finally {
    server.kill('SIGTERM'); await cf.stop(); await sleep(300); fs.rmSync(temp, { recursive: true, force: true });
  }
});
