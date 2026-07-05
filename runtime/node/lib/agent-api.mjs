import http from 'node:http';
import { URL } from 'node:url';
import { WireGuardManager } from './wireguard.mjs';
import { bearerToken, log, publicError, readJsonBody, sendJson, VERSION } from './utils.mjs';

async function requestJson(url, { method = 'GET', token, body, timeoutMs = 15000 } = {}) {
  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(payload?.message || `HTTP ${response.status}`);
    error.statusCode = response.status;
    error.code = payload?.error || 'CONTROL_API_ERROR';
    throw error;
  }
  return payload;
}

export class AgentLocalApi {
  constructor({ config, configDir, host = '127.0.0.1', port = 7390 }) {
    this.config = config;
    this.configDir = configDir;
    this.host = host;
    this.port = port;
    this.server = null;
    this.wireguard = new WireGuardManager({ configDir: `${configDir}/wireguard` });
  }

  async start() {
    this.server = http.createServer((req, res) => void this.#handle(req, res));
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.port, this.host, resolve); });
    log('agent-api', 'info', 'API local do Agent ativa.', { host: this.host, port: this.port });
  }

  async stop() {
    if (!this.server) return;
    this.server.closeAllConnections?.();
    await new Promise((resolve) => this.server.close(resolve));
  }

  #auth(req) {
    const token = bearerToken(req) || String(req.headers['x-tunnara-local-token'] || '');
    if (!this.config.localApiToken || token.length !== this.config.localApiToken.length || token !== this.config.localApiToken) {
      const error = new Error('Token da API local inválido.');
      error.statusCode = 401; error.code = 'LOCAL_API_UNAUTHENTICATED'; throw error;
    }
  }

  async #control(path, options = {}) {
    return requestJson(`${this.config.controlUrl}${path}`, { ...options, token: this.config.sessionToken });
  }

  async #handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') return sendJson(res, 200, { status: 'ok', service: 'agent-local-api', version: VERSION });
      this.#auth(req);
      if (req.method === 'GET' && url.pathname === '/v1/status') {
        const [overview, tunnels, wireguard] = await Promise.all([
          this.#control('/api/v1/overview'), this.#control('/api/v1/tunnels'), this.wireguard.status().catch((error) => ({ available: false, error: error.message })),
        ]);
        return sendJson(res, 200, {
          agentId: this.config.agentId, name: this.config.name, controlUrl: this.config.controlUrl,
          relayUrl: this.config.relayUrl, overview, tunnels: tunnels.data, wireguard,
        });
      }
      if (req.method === 'GET' && url.pathname === '/v1/tunnels') return sendJson(res, 200, await this.#control('/api/v1/tunnels'));
      if (req.method === 'POST' && url.pathname === '/v1/tunnels') {
        const body = await readJsonBody(req);
        return sendJson(res, 201, await this.#control('/api/v1/tunnels', { method: 'POST', body }));
      }
      const tunnelDelete = url.pathname.match(/^\/v1\/tunnels\/([0-9a-f-]+)$/i);
      if (req.method === 'DELETE' && tunnelDelete) {
        await this.#control(`/api/v1/tunnels/${tunnelDelete[1]}`, { method: 'DELETE' });
        res.writeHead(204); return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/v1/networks') return sendJson(res, 200, await this.#control('/api/v1/networks'));
      const networkJoin = url.pathname.match(/^\/v1\/networks\/([0-9a-f-]+)\/join$/i);
      if (req.method === 'POST' && networkJoin) {
        const keys = await this.wireguard.generateKeyPair(networkJoin[1]);
        const result = await this.#control(`/api/v1/networks/${networkJoin[1]}/peers`, {
          method: 'POST', body: { publicKey: keys.publicKey, endpoint: null },
        });
        const file = this.wireguard.writeConfig({
          network: result.network, peer: result.peer, peers: result.peers,
          privateKey: keys.privateKey, dns: result.network.dns_domain || null,
        });
        let activation = { status: 'configured', config: file };
        const body = await readJsonBody(req);
        if (body.activate !== false) activation = await this.wireguard.up(networkJoin[1]);
        return sendJson(res, 200, { ...result, activation, capabilities: this.wireguard.capabilities() });
      }
      const networkLeave = url.pathname.match(/^\/v1\/networks\/([0-9a-f-]+)\/leave$/i);
      if (req.method === 'POST' && networkLeave) return sendJson(res, 200, await this.wireguard.down(networkLeave[1]));
      if (req.method === 'GET' && url.pathname === '/v1/wireguard/capabilities') return sendJson(res, 200, this.wireguard.capabilities());
      return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Rota local não encontrada.' });
    } catch (error) {
      log('agent-api', error.statusCode && error.statusCode < 500 ? 'warn' : 'error', error.message, { path: url.pathname });
      sendJson(res, Number(error.statusCode) || 500, publicError(error));
    }
  }
}
