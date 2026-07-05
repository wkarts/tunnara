import crypto from 'node:crypto';
import dgram from 'node:dgram';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { URL } from 'node:url';
import { FramedConnection, onceFrame } from './framing.mjs';
import { CloudflareClient, cloudflareRecordTarget } from './cloudflare.mjs';
import { decryptSecret, encryptSecret } from './secrets.mjs';
import { relayEndpoint } from './cluster.mjs';
import {
  agentAuthMessage, bearerToken, DEFAULT_MAX_BODY, envInt, isLoopbackHost, log, normalizeHostname,
  publicError, randomToken, readJsonBody, readRequestBody, sendJson, uuid, VERSION,
} from './utils.mjs';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function optionalTlsOptions(prefix) {
  const cert = process.env[`${prefix}_TLS_CERT`];
  const key = process.env[`${prefix}_TLS_KEY`];
  if (!cert || !key) return null;
  return { cert: fs.readFileSync(cert), key: fs.readFileSync(key), minVersion: 'TLSv1.2' };
}

function createWebServer(prefix, handler) {
  const options = optionalTlsOptions(prefix);
  return options ? https.createServer(options, handler) : http.createServer(handler);
}

function jsonRouteError(res, error) {
  const status = Number(error.statusCode) || 500;
  sendJson(res, status, publicError(error));
}

function mapAgent(row) {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    architecture: row.architecture,
    version: row.version,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

function mapTunnel(row, publicScheme = 'http', publicHost = '') {
  const protocol = String(row.protocol || 'http').toLowerCase();
  const endpoint = ['http', 'https'].includes(protocol)
    ? `${protocol === 'https' ? 'https' : publicScheme}://${row.hostname}`
    : `${protocol}://${publicHost || row.hostname}:${row.public_port}`;
  return {
    id: row.id,
    organizationId: row.organization_id,
    agentId: row.agent_id,
    name: row.name,
    protocol,
    hostname: row.hostname,
    endpoint,
    publicPort: row.public_port,
    transport: row.transport || 'auto',
    tlsMode: row.tls_mode || 'automatic',
    dnsRecordId: row.dns_record_id || null,
    targetHost: row.target_host,
    targetPort: row.target_port,
    target: `${row.target_host}:${row.target_port}`,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeIntegration(row) {
  if (!row) return null;
  return {
    id: row.id, provider: row.provider, name: row.name, config: row.config || {}, status: row.status,
    hasSecret: Boolean(row.secret_ciphertext), lastTestedAt: row.last_tested_at, lastError: row.last_error,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class ControlServer {
  constructor({ db, host = '0.0.0.0', port = 7100, relay = null, baseDomain = 'tunnara.local', publicScheme = 'http', publicHost = '' }) {
    this.db = db;
    this.host = host;
    this.port = port;
    this.relay = relay;
    this.baseDomain = baseDomain;
    this.publicScheme = publicScheme;
    this.publicHost = publicHost || process.env.TUNNARA_PUBLIC_EDGE_HOST || baseDomain;
    this.server = null;
    this.rateLimits = new Map();
    this.agentAuthNonces = new Map();
  }

  async start() {
    this.server = createWebServer('TUNNARA_CONTROL', (req, res) => this.#handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, resolve);
    });
    log('control', 'info', 'Control API ativa.', { host: this.host, port: this.port });
  }

  async stop() {
    if (!this.server) return;
    this.server.closeAllConnections?.();
    await new Promise((resolve) => this.server.close(resolve));
  }

  #secureHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-Tunnara-Version', VERSION);
  }

  #cors(req, res) {
    this.#secureHeaders(res);
    const configured = String(process.env.TUNNARA_CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
    const origin = String(req.headers.origin || '');
    if (configured.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && configured.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Tunnara-Provisioning-Token, X-Request-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
    return false;
  }

  #rateLimit(req, bucket, limit, windowMs) {
    const now = Date.now();
    const key = `${bucket}:${req.socket.remoteAddress || 'unknown'}`;
    const current = this.rateLimits.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    this.rateLimits.set(key, entry);
    if (entry.count > limit) {
      const error = new Error('Muitas tentativas. Aguarde antes de tentar novamente.');
      error.statusCode = 429;
      error.code = 'RATE_LIMITED';
      error.retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      throw error;
    }
  }

  #auth(req, allowed = ['api'], requiredScope = '') {
    const raw = bearerToken(req);
    const api = allowed.includes('api') ? this.db.authenticateApiToken(raw) : null;
    if (api) {
      const scopes = JSON.parse(api.scopes_json);
      if (requiredScope && !scopes.includes('*') && !scopes.includes(requiredScope)) {
        const error = new Error(`Escopo obrigatório ausente: ${requiredScope}.`);
        error.statusCode = 403;
        error.code = 'INSUFFICIENT_SCOPE';
        throw error;
      }
      return { type: 'api', raw, organizationId: api.organization_id, id: api.token_id, scopes };
    }
    const agent = allowed.includes('agent') ? this.db.authenticateAgentToken(raw) : null;
    if (agent) return { type: 'agent', raw, organizationId: agent.organization_id, id: agent.id, agent };
    const error = new Error('Credencial ausente, inválida ou revogada.');
    error.statusCode = 401;
    error.code = 'UNAUTHENTICATED';
    throw error;
  }


  #clusterAuth(req) {
    const expected = String(process.env.TUNNARA_CLUSTER_TOKEN || '');
    const received = String(req.headers['x-tunnara-cluster-token'] || bearerToken(req));
    if (!expected || received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
      const error = new Error('Credencial interna do cluster inválida.');
      error.statusCode = 401;
      error.code = 'CLUSTER_UNAUTHENTICATED';
      throw error;
    }
  }

  #verifyAgentHello(hello) {
    const sessionToken = String(hello.sessionToken || '');
    const agent = this.db.authenticateAgentToken(sessionToken);
    if (!agent || agent.id !== hello.agentId) {
      const error = new Error('Credencial do agente inválida.');
      error.statusCode = 401; error.code = 'AGENT_AUTH_FAILED'; throw error;
    }
    const timestampMs = Date.parse(String(hello.timestamp || ''));
    const nonce = String(hello.nonce || '');
    const proof = String(hello.proof || '');
    const replayKey = `${agent.id}:${nonce}`;
    const now = Date.now();
    for (const [key, expiresAt] of this.agentAuthNonces) if (expiresAt <= now) this.agentAuthNonces.delete(key);
    let valid = Number.isFinite(timestampMs) && Math.abs(now - timestampMs) <= 60_000
      && /^[A-Za-z0-9_-]{24,128}$/.test(nonce);
    if (valid) {
      try {
        valid = crypto.verify(null, agentAuthMessage({ agentId: agent.id, timestamp: String(hello.timestamp), nonce, sessionToken }), agent.public_key, Buffer.from(proof, 'base64'));
      } catch { valid = false; }
    }
    if (!valid) {
      const error = new Error('Prova criptográfica do agente inválida.');
      error.statusCode = 401; error.code = 'AGENT_PROOF_INVALID'; throw error;
    }
    if (!this.db.consumeAgentAuthNonce(agent.id, nonce, 120)) {
      const error = new Error('Nonce do agente já utilizado.'); error.statusCode = 401; error.code = 'AGENT_REPLAY_DETECTED'; throw error;
    }
    return agent;
  }

  #cloudflareIntegration(organizationId, requireSecret = true) {
    const integration = this.db.getIntegration(organizationId, 'cloudflare', 'default');
    if (!integration) {
      const error = new Error('Integração Cloudflare ainda não foi configurada.');
      error.statusCode = 409;
      error.code = 'CLOUDFLARE_NOT_CONFIGURED';
      throw error;
    }
    if (requireSecret && !integration.secret_ciphertext) {
      const error = new Error('Cloudflare API Token não foi armazenado.');
      error.statusCode = 409;
      error.code = 'CLOUDFLARE_TOKEN_MISSING';
      throw error;
    }
    return integration;
  }

  #cloudflareClient(integration) {
    return new CloudflareClient({
      apiToken: decryptSecret(integration.secret_ciphertext),
      baseUrl: integration.config.apiBaseUrl || process.env.TUNNARA_CLOUDFLARE_API_BASE_URL || 'https://api.cloudflare.com/client/v4',
      timeoutMs: envInt('TUNNARA_CLOUDFLARE_TIMEOUT_MS', 15000),
    });
  }

  async #ensureManagedDns(organizationId, tunnel, requested = {}) {
    if (!['http', 'https'].includes(tunnel.protocol)) return null;
    const integration = this.#cloudflareIntegration(organizationId);
    const client = this.#cloudflareClient(integration);
    const config = integration.config || {};
    const zoneName = normalizeHostname(config.zoneName || this.baseDomain);
    const zoneId = config.zoneId || await client.findZoneId(zoneName);
    const target = cloudflareRecordTarget({
      edgeHostname: requested.edgeHostname || config.edgeHostname || process.env.TUNNARA_CLOUDFLARE_EDGE_HOSTNAME,
      edgeAddress: requested.edgeAddress || config.edgeAddress || process.env.TUNNARA_CLOUDFLARE_EDGE_ADDRESS,
    });
    const ensured = await client.ensureRecord(zoneId, {
      ...target,
      name: tunnel.hostname,
      proxied: requested.proxied ?? config.proxied ?? false,
      ttl: requested.ttl || config.ttl || 1,
      comment: `Tunnara tunnel ${tunnel.id}`,
    });
    const saved = this.db.saveDnsRecord({
      organizationId, integrationId: integration.id, tunnelId: tunnel.id, zoneId,
      providerRecordId: ensured.record.id, type: ensured.record.type || target.type,
      name: ensured.record.name || tunnel.hostname, content: ensured.record.content || target.content,
      proxied: ensured.record.proxied ?? requested.proxied ?? config.proxied ?? false,
      ttl: ensured.record.ttl || requested.ttl || config.ttl || 1,
    });
    this.db.setTunnelDnsRecord(tunnel.id, saved.id);
    this.db.audit(organizationId, 'api_token', null, 'dns_record.ensured', 'dns_record', saved.id, 'success', {
      provider: 'cloudflare', action: ensured.action, name: saved.name,
    });
    return saved;
  }

  async #deleteManagedDns(organizationId, dnsRecordId) {
    if (!dnsRecordId) return null;
    const record = this.db.getDnsRecord(organizationId, dnsRecordId);
    if (!record) return null;
    const integration = record.integration_id ? this.db.getIntegrationById(organizationId, record.integration_id) : null;
    if (integration?.provider === 'cloudflare' && integration.secret_ciphertext && record.zone_id && record.provider_record_id) {
      await this.#cloudflareClient(integration).deleteRecord(record.zone_id, record.provider_record_id);
    }
    this.db.deleteDnsRecord(organizationId, dnsRecordId);
    return record;
  }

  async #handle(req, res) {
    if (this.#cors(req, res)) return;
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/api/v1/health')) {
        return sendJson(res, 200, { status: 'ok', service: 'control', version: VERSION });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/agents/register') {
        this.#rateLimit(req, 'agent-register', 30, 15 * 60_000);
        const body = await readJsonBody(req);
        const token = String(req.headers['x-tunnara-provisioning-token'] || body.provisioningToken || '');
        if (!token) {
          const error = new Error('Token de provisionamento obrigatório.');
          error.statusCode = 401;
          error.code = 'PROVISIONING_TOKEN_REQUIRED';
          throw error;
        }
        for (const field of ['name', 'platform', 'architecture', 'version', 'publicKey']) {
          if (!String(body[field] ?? '').trim()) {
            const error = new Error(`Campo obrigatório ausente: ${field}.`);
            error.statusCode = 422;
            error.code = 'VALIDATION_ERROR';
            throw error;
          }
        }
        try {
          const key = crypto.createPublicKey(String(body.publicKey));
          if (key.asymmetricKeyType !== 'ed25519') throw new Error('A chave deve ser Ed25519.');
        } catch {
          const error = new Error('publicKey deve conter uma chave pública Ed25519 válida em PEM.');
          error.statusCode = 422;
          error.code = 'PUBLIC_KEY_INVALID';
          throw error;
        }
        const result = this.db.registerAgent(token, body);
        this.db.markStaleNodesOffline(envInt('TUNNARA_NODE_STALE_SECONDS', 60));
        const relayNodes = this.db.listNodes('relay').filter((node) => node.status === 'healthy' && node.public_url);
        const relayUrls = relayNodes.map((node) => node.public_url);
        const fallbackRelay = process.env.TUNNARA_PUBLIC_RELAY_URL || `tcp://127.0.0.1:${envInt('TUNNARA_RELAY_PORT', 7300)}`;
        if (!relayUrls.length) relayUrls.push(fallbackRelay);
        return sendJson(res, 201, {
          ...result,
          relayUrl: relayUrls[0], relayUrls,
          controlUrl: process.env.TUNNARA_PUBLIC_CONTROL_URL || `http://127.0.0.1:${this.port}`,
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/agents/heartbeat') {
        const auth = this.#auth(req, ['agent']);
        this.db.touchAgent(auth.id, 'online');
        return sendJson(res, 200, { status: 'ok', serverTime: new Date().toISOString() });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/session') {
        const auth = this.#auth(req, ['api']);
        const token = this.db.authenticateApiToken(auth.raw);
        return sendJson(res, 200, {
          authenticated: true,
          organizationId: auth.organizationId,
          organizationName: token.organization_name,
          tokenId: auth.id,
          scopes: auth.scopes,
        });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/overview') {
        const auth = this.#auth(req, ['api', 'agent']);
        return sendJson(res, 200, this.db.overview(auth.organizationId, this.relay?.activeProxyRequests ?? 0));
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/integrations') {
        const auth = this.#auth(req, ['api'], 'integrations:read');
        return sendJson(res, 200, { data: this.db.listIntegrations(auth.organizationId).map(sanitizeIntegration) });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/integrations/cloudflare') {
        const auth = this.#auth(req, ['api'], 'integrations:read');
        return sendJson(res, 200, sanitizeIntegration(this.db.getIntegration(auth.organizationId, 'cloudflare', 'default')));
      }
      if (req.method === 'PUT' && url.pathname === '/api/v1/integrations/cloudflare') {
        const auth = this.#auth(req, ['api'], 'integrations:write');
        const body = await readJsonBody(req);
        const zoneName = normalizeHostname(body.zoneName || this.baseDomain);
        const managedDomain = normalizeHostname(body.managedDomain || this.baseDomain);
        if (!zoneName) {
          const error = new Error('zoneName deve ser um domínio válido.');
          error.statusCode = 422; error.code = 'ZONE_NAME_INVALID'; throw error;
        }
        if (!managedDomain || (managedDomain !== zoneName && !managedDomain.endsWith(`.${zoneName}`))) {
          const error = new Error('managedDomain precisa pertencer à zona Cloudflare configurada.');
          error.statusCode = 422; error.code = 'MANAGED_DOMAIN_OUTSIDE_ZONE'; throw error;
        }
        if (!body.apiToken && !this.db.getIntegration(auth.organizationId, 'cloudflare', 'default')?.secret_ciphertext) {
          const error = new Error('apiToken é obrigatório na primeira configuração.');
          error.statusCode = 422; error.code = 'CLOUDFLARE_TOKEN_REQUIRED'; throw error;
        }
        const config = {
          zoneName,
          managedDomain,
          zoneId: body.zoneId ? String(body.zoneId) : null,
          edgeHostname: body.edgeHostname ? normalizeHostname(body.edgeHostname) : null,
          edgeAddress: body.edgeAddress ? String(body.edgeAddress) : null,
          proxied: Boolean(body.proxied),
          ttl: Math.max(1, Number(body.ttl || 1)),
          dnsMode: ['wildcard', 'per-tunnel'].includes(body.dnsMode) ? body.dnsMode : 'wildcard',
          acmeEmail: body.acmeEmail ? String(body.acmeEmail) : null,
          acmeStaging: Boolean(body.acmeStaging),
          apiBaseUrl: body.apiBaseUrl ? String(body.apiBaseUrl).replace(/\/$/, '') : null,
        };
        if (!config.edgeHostname && !config.edgeAddress) {
          const error = new Error('Informe edgeHostname ou edgeAddress.');
          error.statusCode = 422; error.code = 'EDGE_DNS_TARGET_REQUIRED'; throw error;
        }
        const integration = this.db.upsertIntegration({
          organizationId: auth.organizationId, provider: 'cloudflare', name: 'default', config,
          secretCiphertext: body.apiToken ? encryptSecret(String(body.apiToken)) : null,
        });
        return sendJson(res, 200, sanitizeIntegration(integration));
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/integrations/cloudflare/test') {
        const auth = this.#auth(req, ['api'], 'integrations:write');
        const integration = this.#cloudflareIntegration(auth.organizationId);
        try {
          const client = this.#cloudflareClient(integration);
          const verification = await client.verifyToken();
          const zoneId = integration.config.zoneId || await client.findZoneId(integration.config.zoneName || this.baseDomain);
          this.db.updateIntegrationTest(integration.id, true);
          return sendJson(res, 200, { status: 'ok', verification, zoneId, zoneName: integration.config.zoneName, managedDomain: integration.config.managedDomain || this.baseDomain });
        } catch (error) {
          this.db.updateIntegrationTest(integration.id, false, error.message);
          throw error;
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/integrations/cloudflare/bootstrap-dns') {
        const auth = this.#auth(req, ['api'], 'dns:write');
        const integration = this.#cloudflareIntegration(auth.organizationId);
        const client = this.#cloudflareClient(integration);
        const config = integration.config || {};
        const zoneName = normalizeHostname(config.zoneName || this.baseDomain);
        const managedDomain = normalizeHostname(config.managedDomain || this.baseDomain);
        const zoneId = config.zoneId || await client.findZoneId(zoneName);
        const target = cloudflareRecordTarget({ edgeHostname: config.edgeHostname, edgeAddress: config.edgeAddress });
        const names = [
          managedDomain,
          `*.${managedDomain}`,
          `control.${managedDomain}`,
          `console.${managedDomain}`,
          `relay.${managedDomain}`, 
        ];
        const data = [];
        for (const name of names) {
          const result = await client.ensureRecord(zoneId, {
            ...target, name, proxied: name.startsWith('relay.') ? false : Boolean(config.proxied),
            ttl: config.ttl || 1, comment: 'Managed by Tunnara bootstrap',
          });
          data.push(this.db.saveDnsRecord({
            organizationId: auth.organizationId, integrationId: integration.id, zoneId,
            providerRecordId: result.record.id, type: result.record.type || target.type,
            name: result.record.name || name, content: result.record.content || target.content,
            proxied: result.record.proxied ?? config.proxied, ttl: result.record.ttl || config.ttl || 1,
          }));
        }
        this.db.upsertCertificate({
          organizationId: auth.organizationId, primaryName: managedDomain, sans: [`*.${managedDomain}`],
          issuer: 'letsencrypt', mode: 'caddy-cloudflare-dns01', status: 'managed',
          metadata: { acmeEmail: config.acmeEmail || null, staging: Boolean(config.acmeStaging) },
        });
        return sendJson(res, 200, { status: 'configured', zoneId, zoneName, managedDomain, records: data });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/dns/records') {
        const auth = this.#auth(req, ['api'], 'dns:read');
        return sendJson(res, 200, { data: this.db.listDnsRecords(auth.organizationId) });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/dns/records') {
        const auth = this.#auth(req, ['api'], 'dns:write');
        const body = await readJsonBody(req);
        const integration = this.#cloudflareIntegration(auth.organizationId);
        const client = this.#cloudflareClient(integration);
        const config = integration.config || {};
        const name = normalizeHostname(body.name);
        const managedDomain = normalizeHostname(config.managedDomain || this.baseDomain);
        if (!name || (name !== managedDomain && !name.endsWith(`.${managedDomain}`))) {
          const error = new Error('O registro precisa pertencer à zona Cloudflare configurada.');
          error.statusCode = 422; error.code = 'DNS_NAME_OUTSIDE_ZONE'; throw error;
        }
        const zoneId = config.zoneId || await client.findZoneId(config.zoneName || this.baseDomain);
        const result = await client.ensureRecord(zoneId, {
          type: String(body.type || 'CNAME').toUpperCase(), name, content: String(body.content || ''),
          proxied: Boolean(body.proxied), ttl: Number(body.ttl || 1), comment: 'Managed by Tunnara',
        });
        const saved = this.db.saveDnsRecord({
          organizationId: auth.organizationId, integrationId: integration.id, zoneId,
          providerRecordId: result.record.id, type: result.record.type, name: result.record.name,
          content: result.record.content, proxied: result.record.proxied, ttl: result.record.ttl,
        });
        return sendJson(res, 201, saved);
      }
      const dnsDelete = url.pathname.match(/^\/api\/v1\/dns\/records\/([0-9a-f-]+)$/i);
      if (req.method === 'DELETE' && dnsDelete) {
        const auth = this.#auth(req, ['api'], 'dns:write');
        const record = this.db.getDnsRecord(auth.organizationId, dnsDelete[1]);
        if (!record) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Registro DNS não encontrado.' });
        await this.#deleteManagedDns(auth.organizationId, record.id);
        res.writeHead(204); return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/certificates') {
        const auth = this.#auth(req, ['api'], 'certificates:read');
        return sendJson(res, 200, { data: this.db.listCertificates(auth.organizationId) });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/nodes') {
        this.#auth(req, ['api'], 'nodes:read');
        this.db.markStaleNodesOffline(envInt('TUNNARA_NODE_STALE_SECONDS', 60));
        return sendJson(res, 200, { data: this.db.listNodes(url.searchParams.get('type') || null) });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/networks') {
        const auth = this.#auth(req, ['api'], 'networks:read');
        return sendJson(res, 200, { data: this.db.listPrivateNetworks(auth.organizationId) });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/networks') {
        const auth = this.#auth(req, ['api'], 'networks:write');
        const body = await readJsonBody(req);
        const network = this.db.createPrivateNetwork({
          organizationId: auth.organizationId, name: String(body.name || '').trim(), cidr: String(body.cidr || '').trim(),
          dnsDomain: body.dnsDomain ? normalizeHostname(body.dnsDomain) : null,
          mode: ['hub-spoke', 'mesh'].includes(body.mode) ? body.mode : 'hub-spoke', hubAgentId: body.hubAgentId || null,
        });
        return sendJson(res, 201, network);
      }
      const networkMatch = url.pathname.match(/^\/api\/v1\/networks\/([0-9a-f-]+)$/i);
      if (req.method === 'DELETE' && networkMatch) {
        const auth = this.#auth(req, ['api'], 'networks:write');
        const deleted = this.db.deletePrivateNetwork(auth.organizationId, networkMatch[1]);
        if (!deleted) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Rede não encontrada.' });
        res.writeHead(204); return res.end();
      }
      const peersMatch = url.pathname.match(/^\/api\/v1\/networks\/([0-9a-f-]+)\/peers$/i);
      if (req.method === 'GET' && peersMatch) {
        const auth = this.#auth(req, ['api', 'agent'], 'networks:read');
        const network = this.db.getPrivateNetwork(auth.organizationId, peersMatch[1]);
        if (!network) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Rede não encontrada.' });
        return sendJson(res, 200, { network, data: this.db.listNetworkPeers(auth.organizationId, network.id) });
      }
      if (req.method === 'POST' && peersMatch) {
        const auth = this.#auth(req, ['api', 'agent'], 'networks:write');
        const body = await readJsonBody(req);
        const agentId = auth.type === 'agent' ? auth.id : String(body.agentId || '');
        if (!agentId) { const error = new Error('agentId é obrigatório.'); error.statusCode = 422; throw error; }
        const peer = this.db.upsertNetworkPeer({
          organizationId: auth.organizationId, networkId: peersMatch[1], agentId,
          publicKey: body.publicKey || null, endpoint: body.endpoint || null,
          allowedIps: Array.isArray(body.allowedIps) ? body.allowedIps : [],
          persistentKeepalive: Number(body.persistentKeepalive || 25),
        });
        const network = this.db.getPrivateNetwork(auth.organizationId, peersMatch[1]);
        return sendJson(res, 201, { network, peer, peers: this.db.listNetworkPeers(auth.organizationId, network.id) });
      }
      if (req.method === 'POST' && url.pathname === '/internal/v1/agents/authenticate') {
        this.#clusterAuth(req);
        const body = await readJsonBody(req);
        const agent = this.#verifyAgentHello(body);
        return sendJson(res, 200, { agent: { id: agent.id, organizationId: agent.organization_id, status: agent.status } });
      }
      if (req.method === 'POST' && url.pathname === '/internal/v1/agents/presence') {
        this.#clusterAuth(req);
        const body = await readJsonBody(req);
        const agentId = String(body.agentId || '');
        if (!agentId) { const error = new Error('agentId obrigatório.'); error.statusCode = 422; throw error; }
        if (body.status === 'offline') {
          this.db.clearAgentPresence(agentId, body.relayNodeId || null);
          return sendJson(res, 200, { status: 'offline' });
        }
        this.db.setAgentPresence(agentId, body.relayNodeId || null, body.relayEdgeUrl || null);
        this.db.touchAgent(agentId, 'online');
        return sendJson(res, 200, { status: 'online' });
      }
      if (req.method === 'POST' && url.pathname === '/internal/v1/agents/heartbeat') {
        this.#clusterAuth(req);
        const body = await readJsonBody(req);
        this.db.touchAgent(String(body.agentId || ''), 'online');
        if (body.relayNodeId || body.relayEdgeUrl) this.db.setAgentPresence(String(body.agentId || ''), body.relayNodeId || null, body.relayEdgeUrl || null);
        return sendJson(res, 200, { status: 'ok', serverTime: new Date().toISOString() });
      }
      if (req.method === 'GET' && url.pathname === '/internal/v1/tunnels') {
        this.#clusterAuth(req);
        const protocol = String(url.searchParams.get('protocol') || '').toLowerCase();
        const rows = protocol ? this.db.listActiveTunnelsByProtocol(protocol) : this.db.listAllActiveTunnels();
        return sendJson(res, 200, { data: rows.map((tunnel) => ({ tunnel, presence: this.db.getAgentPresence(tunnel.agent_id) })) });
      }
      if (req.method === 'POST' && url.pathname === '/internal/v1/nodes/register') {
        this.#clusterAuth(req);
        const body = await readJsonBody(req);
        return sendJson(res, 201, this.db.upsertNode({
          id: body.id || uuid(), nodeType: body.nodeType, name: body.name, region: body.region || 'default',
          publicUrl: body.publicUrl || null, internalUrl: body.internalUrl || null,
          transport: body.transport || 'tcp', status: 'healthy', capacity: Number(body.capacity || 1000),
          activeConnections: Number(body.activeConnections || 0), metadata: body.metadata || {},
        }));
      }
      if (req.method === 'POST' && url.pathname === '/internal/v1/nodes/heartbeat') {
        this.#clusterAuth(req);
        const body = await readJsonBody(req);
        return sendJson(res, 200, this.db.upsertNode({
          id: body.id || uuid(), nodeType: body.nodeType, name: body.name, region: body.region || 'default',
          publicUrl: body.publicUrl || null, internalUrl: body.internalUrl || null,
          transport: body.transport || 'tcp', status: body.status || 'healthy', capacity: Number(body.capacity || 1000),
          activeConnections: Number(body.activeConnections || 0), metadata: body.metadata || {},
        }));
      }
      const internalRoute = url.pathname.match(/^\/internal\/v1\/routes\/hostname\/(.+)$/i);
      if (req.method === 'GET' && internalRoute) {
        this.#clusterAuth(req);
        const hostname = normalizeHostname(decodeURIComponent(internalRoute[1]));
        const tunnel = hostname ? this.db.getTunnelByHostname(hostname) : null;
        if (!tunnel) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Rota não encontrada.' });
        return sendJson(res, 200, { tunnel, presence: this.db.getAgentPresence(tunnel.agent_id) });
      }
      const internalTunnel = url.pathname.match(/^\/internal\/v1\/tunnels\/([0-9a-f-]+)$/i);
      if (req.method === 'GET' && internalTunnel) {
        this.#clusterAuth(req);
        const tunnel = this.db.getTunnel(internalTunnel[1]);
        if (!tunnel) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Túnel não encontrado.' });
        return sendJson(res, 200, { tunnel, presence: this.db.getAgentPresence(tunnel.agent_id) });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/agents') {
        const auth = this.#auth(req, ['api'], 'agents:read');
        return sendJson(res, 200, { data: this.db.listAgents(auth.organizationId).map(mapAgent) });
      }
      const agentRevoke = url.pathname.match(/^\/api\/v1\/agents\/([0-9a-f-]+)\/revoke$/i);
      if (req.method === 'POST' && agentRevoke) {
        const auth = this.#auth(req, ['api'], 'agents:write');
        const revoked = this.db.revokeAgent(auth.organizationId, agentRevoke[1]);
        if (!revoked) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Agente não encontrado.' });
        const live = this.relay?.agents?.get(agentRevoke[1]);
        if (live) live.connection.destroy(new Error('Agente revogado.'));
        return sendJson(res, 200, { status: 'revoked', id: agentRevoke[1] });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/api-tokens') {
        const auth = this.#auth(req, ['api'], 'tokens:read');
        return sendJson(res, 200, { data: this.db.listApiTokens(auth.organizationId) });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/api-tokens') {
        const auth = this.#auth(req, ['api'], 'tokens:write');
        const body = await readJsonBody(req);
        const name = String(body.name || '').trim();
        const allowedScopes = new Set(['*', 'agents:read', 'agents:write', 'tunnels:read', 'tunnels:write', 'audit:read', 'provisioning:write', 'tokens:read', 'tokens:write', 'integrations:read', 'integrations:write', 'dns:read', 'dns:write', 'nodes:read', 'nodes:write', 'networks:read', 'networks:write', 'certificates:read']);
        const scopes = Array.isArray(body.scopes) && body.scopes.length ? [...new Set(body.scopes.map(String))] : ['*'];
        if (!name || scopes.some((scope) => !allowedScopes.has(scope))) {
          const error = new Error('Nome ou escopos do token são inválidos.');
          error.statusCode = 422;
          error.code = 'TOKEN_VALIDATION_ERROR';
          throw error;
        }
        return sendJson(res, 201, this.db.createApiToken(auth.organizationId, name, scopes));
      }
      const tokenDelete = url.pathname.match(/^\/api\/v1\/api-tokens\/([0-9a-f-]+)$/i);
      if (req.method === 'DELETE' && tokenDelete) {
        const auth = this.#auth(req, ['api'], 'tokens:write');
        if (tokenDelete[1] === auth.id) {
          const error = new Error('Não é permitido revogar o token usado na própria requisição.');
          error.statusCode = 409;
          error.code = 'TOKEN_SELF_REVOKE_DENIED';
          throw error;
        }
        const revoked = this.db.revokeApiToken(auth.organizationId, tokenDelete[1]);
        if (!revoked) return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Token não encontrado.' });
        res.writeHead(204); return res.end();
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/provisioning-tokens') {
        const auth = this.#auth(req, ['api'], 'provisioning:write');
        const body = await readJsonBody(req);
        const ttl = Math.min(Math.max(Number(body.ttlSeconds || 900), 60), 86400);
        return sendJson(res, 201, this.db.createProvisioningToken(auth.organizationId, String(body.name || 'Novo agente'), ttl));
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/tunnels') {
        const auth = this.#auth(req, ['api', 'agent'], 'tunnels:read');
        const rows = this.db.listTunnels(auth.organizationId, auth.type === 'agent' ? auth.id : null);
        return sendJson(res, 200, { data: rows.map((row) => mapTunnel(row, this.publicScheme, this.publicHost)) });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/tunnels') {
        const auth = this.#auth(req, ['api', 'agent'], 'tunnels:write');
        const body = await readJsonBody(req);
        const protocol = String(body.protocol || 'http').toLowerCase();
        if (!['http', 'https', 'tcp', 'udp'].includes(protocol)) {
          const error = new Error('protocol deve ser http, https, tcp ou udp.');
          error.statusCode = 422;
          error.code = 'PROTOCOL_NOT_SUPPORTED';
          throw error;
        }
        const targetPort = Number(body.targetPort);
        if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
          const error = new Error('targetPort deve estar entre 1 e 65535.');
          error.statusCode = 422;
          error.code = 'TARGET_PORT_INVALID';
          throw error;
        }
        const targetHost = String(body.targetHost || '127.0.0.1').trim();
        if (!isLoopbackHost(targetHost) && process.env.TUNNARA_ALLOW_REMOTE_TARGETS !== 'true') {
          const error = new Error('Por segurança, destinos remotos exigem TUNNARA_ALLOW_REMOTE_TARGETS=true.');
          error.statusCode = 422;
          error.code = 'TARGET_HOST_NOT_ALLOWED';
          throw error;
        }
        const agentId = auth.type === 'agent' ? auth.id : String(body.agentId || '');
        if (!agentId) {
          const error = new Error('agentId é obrigatório para tokens administrativos.');
          error.statusCode = 422;
          error.code = 'AGENT_ID_REQUIRED';
          throw error;
        }
        const requested = body.hostname ? normalizeHostname(body.hostname) : null;
        if (body.hostname && !requested) {
          const error = new Error('Hostname inválido.');
          error.statusCode = 422;
          error.code = 'HOSTNAME_INVALID';
          throw error;
        }
        const isWeb = ['http', 'https'].includes(protocol);
        const hostname = isWeb
          ? (requested || `${randomToken('t').slice(2, 12).toLowerCase()}.${this.baseDomain}`)
          : (requested || `${protocol}-${randomToken('p').slice(2, 10).toLowerCase()}.internal.tunnara`);
        let publicPort = null;
        if (!isWeb) {
          const minPort = envInt('TUNNARA_PUBLIC_PORT_MIN', 20000);
          const maxPort = envInt('TUNNARA_PUBLIC_PORT_MAX', 40000);
          publicPort = body.publicPort ? Number(body.publicPort) : this.db.allocatePublicPort(protocol, minPort, maxPort);
          if (!Number.isInteger(publicPort) || publicPort < minPort || publicPort > maxPort) {
            const error = new Error(`publicPort deve estar entre ${minPort} e ${maxPort}.`);
            error.statusCode = 422; error.code = 'PUBLIC_PORT_INVALID'; throw error;
          }
        }
        const tunnel = this.db.createTunnel({
          organizationId: auth.organizationId,
          agentId,
          name: String(body.name || `${protocol.toUpperCase()} ${targetPort}`),
          protocol,
          hostname,
          targetHost,
          targetPort,
          publicPort,
          transport: String(body.transport || 'auto'),
          tlsMode: String(body.tlsMode || (protocol === 'https' ? 'automatic' : 'disabled')),
          edgeNodeId: body.edgeNodeId || null,
          relayNodeId: body.relayNodeId || null,
        });
        let dnsRecord = null;
        const autoDns = body.autoDns === true || (body.autoDns !== false && process.env.TUNNARA_AUTO_DNS === 'true');
        if (isWeb && autoDns) {
          try { dnsRecord = await this.#ensureManagedDns(auth.organizationId, tunnel, body.dns || {}); }
          catch (error) {
            this.db.deleteTunnel(auth.organizationId, tunnel.id);
            throw error;
          }
        }
        const current = this.db.getTunnel(tunnel.id);
        return sendJson(res, 201, { ...mapTunnel(current, this.publicScheme, this.publicHost), dnsRecord });
      }
      const tunnelDelete = url.pathname.match(/^\/api\/v1\/tunnels\/([0-9a-f-]+)$/i);
      if (req.method === 'DELETE' && tunnelDelete) {
        const auth = this.#auth(req, ['api', 'agent'], 'tunnels:write');
        const tunnel = this.db.getTunnel(tunnelDelete[1]);
        if (!tunnel || tunnel.organization_id !== auth.organizationId || (auth.type === 'agent' && tunnel.agent_id !== auth.id)) {
          return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Túnel não encontrado.' });
        }
        if (tunnel.dns_record_id) await this.#deleteManagedDns(auth.organizationId, tunnel.dns_record_id);
        this.db.deleteTunnel(auth.organizationId, tunnel.id, auth.type === 'agent' ? auth.id : null);
        res.writeHead(204); return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/audit') {
        const auth = this.#auth(req, ['api'], 'audit:read');
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);
        return sendJson(res, 200, { data: this.db.listAudit(auth.organizationId, limit) });
      }
      return sendJson(res, 404, { error: 'NOT_FOUND', message: 'Rota não encontrada.' });
    } catch (error) {
      log('control', error.statusCode && error.statusCode < 500 ? 'warn' : 'error', error.message, { path: url.pathname });
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return jsonRouteError(res, error);
    }
  }
}

export class RelayServer {
  constructor({ db, host = '0.0.0.0', agentPort = 7300, edgeHost = '127.0.0.1', edgePort = 7301, controlClient = null, nodeId = null, publicEdgeUrl = null }) {
    this.db = db;
    this.host = host;
    this.agentPort = agentPort;
    this.edgeHost = edgeHost;
    this.edgePort = edgePort;
    this.agentServer = null;
    this.edgeServer = null;
    this.agents = new Map();
    this.pending = new Map();
    this.streams = new Map();
    this.udpSessions = new Map();
    this.activeProxyRequests = 0;
    this.authNonces = new Map();
    this.sockets = new Set();
    this.controlClient = controlClient;
    this.nodeId = nodeId;
    this.publicEdgeUrl = publicEdgeUrl || `tcp://${edgeHost}:${edgePort}`;
  }

  async start() {
    const tlsOptions = optionalTlsOptions('TUNNARA_RELAY');
    this.agentServer = tlsOptions
      ? tls.createServer({ ...tlsOptions, requestCert: false }, (socket) => this.#acceptAgent(socket))
      : net.createServer((socket) => this.#acceptAgent(socket));
    this.edgeServer = net.createServer((socket) => this.#acceptEdge(socket));
    for (const server of [this.agentServer, this.edgeServer]) {
      server.on('connection', (socket) => {
        this.sockets.add(socket);
        socket.once('close', () => this.sockets.delete(socket));
      });
    }
    await Promise.all([
      new Promise((resolve, reject) => { this.agentServer.once('error', reject); this.agentServer.listen(this.agentPort, this.host, resolve); }),
      new Promise((resolve, reject) => { this.edgeServer.once('error', reject); this.edgeServer.listen(this.edgePort, this.edgeHost, resolve); }),
    ]);
    log('relay', 'info', 'Relay ativo.', { agentPort: this.agentPort, edgePort: this.edgePort });
  }

  async stop() {
    for (const entry of this.agents.values()) entry.connection.destroy();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.edge.destroy(); }
    for (const stream of this.streams.values()) stream.edge.destroy();
    this.pending.clear();
    this.streams.clear();
    this.udpSessions.clear();
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    await Promise.all([
      this.agentServer ? new Promise((resolve) => this.agentServer.close(resolve)) : null,
      this.edgeServer ? new Promise((resolve) => this.edgeServer.close(resolve)) : null,
    ].filter(Boolean));
  }

  async #authenticateHello(hello) {
    if (this.controlClient) {
      const response = await this.controlClient.authenticateAgent(hello);
      return { id: response.agent.id, organization_id: response.agent.organizationId, status: response.agent.status };
    }
    const sessionToken = String(hello.sessionToken || '');
    const agent = this.db.authenticateAgentToken(sessionToken);
    if (!agent || agent.id !== hello.agentId) throw Object.assign(new Error('Credencial do agente inválida.'), { code: 'AGENT_AUTH_FAILED' });
    const timestampMs = Date.parse(String(hello.timestamp || ''));
    const nonce = String(hello.nonce || '');
    const proof = String(hello.proof || '');
    const replayKey = `${agent.id}:${nonce}`;
    const now = Date.now();
    for (const [key, expiresAt] of this.authNonces) if (expiresAt <= now) this.authNonces.delete(key);
    let proofValid = Number.isFinite(timestampMs) && Math.abs(now - timestampMs) <= 60_000
      && /^[A-Za-z0-9_-]{24,128}$/.test(nonce);
    if (proofValid) {
      try { proofValid = crypto.verify(null, agentAuthMessage({ agentId: agent.id, timestamp: String(hello.timestamp), nonce, sessionToken }), agent.public_key, Buffer.from(proof, 'base64')); }
      catch { proofValid = false; }
    }
    if (!proofValid) throw Object.assign(new Error('Prova criptográfica do agente inválida.'), { code: 'AGENT_PROOF_INVALID' });
    if (!this.db.consumeAgentAuthNonce(agent.id, nonce, 120)) throw Object.assign(new Error('Nonce do agente já utilizado.'), { code: 'AGENT_REPLAY_DETECTED' });
    return agent;
  }

  async #getTunnel(id) {
    if (this.controlClient) return (await this.controlClient.getTunnel(id)).tunnel;
    return this.db.getTunnel(id);
  }

  async #presence(agentId, status = 'online') {
    if (this.controlClient) {
      try { await this.controlClient.agentPresence({ agentId, relayNodeId: this.nodeId, relayEdgeUrl: this.publicEdgeUrl, status }); } catch (error) { log('relay', 'warn', 'Falha ao atualizar presença no Control.', { agentId, error: error.message }); }
    } else if (status === 'online') {
      this.db.touchAgent(agentId, 'online');
      if (this.nodeId || this.publicEdgeUrl) this.db.setAgentPresence(agentId, this.nodeId, this.publicEdgeUrl);
    } else {
      if (this.nodeId || this.publicEdgeUrl) this.db.clearAgentPresence(agentId, this.nodeId);
      else this.db.markAgentOffline(agentId);
    }
  }

  #acceptAgent(socket) {
    const connection = new FramedConnection(socket);
    let agentId = null;
    const authTimer = setTimeout(() => connection.destroy(new Error('Timeout de autenticação.')), 10000);
    connection.once('frame', (hello) => void (async () => {
      clearTimeout(authTimer);
      try {
        if (hello.type !== 'agent_hello') throw Object.assign(new Error('Handshake de agente inválido.'), { code: 'AGENT_HANDSHAKE_INVALID' });
        const agent = await this.#authenticateHello(hello);
        agentId = agent.id;
        const old = this.agents.get(agentId);
        if (old) old.connection.destroy(new Error('Substituído por nova conexão.'));
        this.agents.set(agentId, { connection, connectedAt: Date.now() });
        await this.#presence(agentId, 'online');
        connection.send({ type: 'agent_hello_ok', agentId, heartbeatIntervalSeconds: 20 });
        log('relay', 'info', 'Agente conectado.', { agentId, remote: socket.remoteAddress, distributed: Boolean(this.controlClient) });
        connection.on('frame', (frame) => void this.#onAgentFrame(agentId, frame));
      } catch (error) {
        connection.send({ type: 'error', code: error.code || 'AGENT_AUTH_FAILED', message: error.message });
        connection.close();
      }
    })());
    connection.on('protocolError', (error) => connection.destroy(error));
    connection.on('close', () => {
      clearTimeout(authTimer);
      if (!agentId) return;
      const current = this.agents.get(agentId);
      if (current?.connection === connection) {
        this.agents.delete(agentId);
        void this.#presence(agentId, 'offline');
      }
      for (const [requestId, pending] of this.pending) {
        if (pending.agentId === agentId) {
          pending.edge.send({ type: 'proxy_error', requestId, status: 502, message: 'Agente desconectado.' });
          pending.edge.close();
          clearTimeout(pending.timer);
          this.pending.delete(requestId);
          this.activeProxyRequests = Math.max(0, this.activeProxyRequests - 1);
        }
      }
      for (const [streamId, stream] of this.streams) {
        if (stream.agentId === agentId) {
          stream.edge.send({ type: 'stream_close', streamId, reason: 'agent_disconnected' });
          stream.edge.close();
          this.streams.delete(streamId);
        }
      }
      for (const [sessionId, session] of this.udpSessions) {
        if (session.agentId === agentId) {
          session.edge.send({ type: 'udp_close', sessionId, reason: 'agent_disconnected' });
          this.udpSessions.delete(sessionId);
        }
      }
      log('relay', 'info', 'Agente desconectado.', { agentId });
    });
    connection.on('error', (error) => log('relay', 'warn', 'Falha na conexão do agente.', { agentId, error: error.message }));
  }

  async #onAgentFrame(agentId, frame) {
    if (frame.type === 'heartbeat') {
      if (this.controlClient) await this.controlClient.agentHeartbeat({ agentId, relayNodeId: this.nodeId, relayEdgeUrl: this.publicEdgeUrl }).catch((error) => log('relay', 'warn', 'Heartbeat remoto falhou.', { agentId, error: error.message }));
      else this.db.touchAgent(agentId, 'online');
      this.agents.get(agentId)?.connection.send({ type: 'heartbeat_ack', at: new Date().toISOString() });
      return;
    }
    if (frame.type === 'proxy_response' || frame.type === 'proxy_error') {
      const pending = this.pending.get(frame.requestId);
      if (!pending || pending.agentId !== agentId) return;
      clearTimeout(pending.timer);
      pending.edge.send(frame);
      pending.edge.close();
      this.pending.delete(frame.requestId);
      this.activeProxyRequests = Math.max(0, this.activeProxyRequests - 1);
      return;
    }
    if (frame.type === 'stream_opened' || frame.type === 'stream_data' || frame.type === 'stream_close') {
      const stream = this.streams.get(frame.streamId);
      if (!stream || stream.agentId !== agentId) return;
      stream.edge.send(frame);
      if (frame.type === 'stream_close') {
        stream.edge.close();
        this.streams.delete(frame.streamId);
      }
      return;
    }
    if (frame.type === 'udp_response' || frame.type === 'udp_close') {
      const session = this.udpSessions.get(frame.sessionId);
      if (!session || session.agentId !== agentId) return;
      session.edge.send(frame);
      session.lastSeenAt = Date.now();
      if (frame.type === 'udp_close') this.udpSessions.delete(frame.sessionId);
    }
  }

  #acceptEdge(socket) {
    const edge = new FramedConnection(socket);
    let streamId = null;
    edge.on('frame', (frame) => {
      if (frame.type === 'proxy_request') return void this.#proxyRequest(edge, frame);
      if (frame.type === 'stream_open') {
        streamId = frame.streamId;
        return void this.#streamOpen(edge, frame);
      }
      if (frame.type === 'udp_datagram') return void this.#udpDatagram(edge, frame);
      if (frame.type === 'udp_close') {
        const session = this.udpSessions.get(frame.sessionId);
        if (session) this.agents.get(session.agentId)?.connection.send(frame);
        this.udpSessions.delete(frame.sessionId);
        return;
      }
      if ((frame.type === 'stream_data' || frame.type === 'stream_close') && streamId) {
        const stream = this.streams.get(streamId);
        const agent = stream ? this.agents.get(stream.agentId) : null;
        if (agent) agent.connection.send(frame);
        if (frame.type === 'stream_close') this.streams.delete(streamId);
      }
    });
    edge.on('close', () => {
      if (!streamId) return;
      const stream = this.streams.get(streamId);
      if (stream) this.agents.get(stream.agentId)?.connection.send({ type: 'stream_close', streamId, reason: 'edge_closed' });
      this.streams.delete(streamId);
    });
    edge.on('protocolError', (error) => edge.destroy(error));
  }

  async #proxyRequest(edge, frame) {
    const tunnel = await this.#getTunnel(frame.tunnelId).catch(() => null);
    if (!tunnel || tunnel.status !== 'active') {
      edge.send({ type: 'proxy_error', requestId: frame.requestId, status: 404, message: 'Túnel não encontrado.' });
      return edge.close();
    }
    const agent = this.agents.get(tunnel.agent_id);
    if (!agent) {
      edge.send({ type: 'proxy_error', requestId: frame.requestId, status: 503, message: 'Agente offline.' });
      return edge.close();
    }
    const requestId = frame.requestId || uuid();
    const timer = setTimeout(() => {
      const pending = this.pending.get(requestId);
      if (!pending) return;
      pending.edge.send({ type: 'proxy_error', requestId, status: 504, message: 'Tempo limite do upstream.' });
      pending.edge.close();
      this.pending.delete(requestId);
      this.activeProxyRequests = Math.max(0, this.activeProxyRequests - 1);
    }, envInt('TUNNARA_UPSTREAM_TIMEOUT_MS', 30000));
    this.pending.set(requestId, { edge, agentId: tunnel.agent_id, timer });
    this.activeProxyRequests += 1;
    agent.connection.send({
      ...frame,
      type: 'proxy_request',
      requestId,
      targetHost: tunnel.target_host,
      targetPort: tunnel.target_port,
      protocol: tunnel.protocol,
    });
  }

  async #streamOpen(edge, frame) {
    const tunnel = await this.#getTunnel(frame.tunnelId).catch(() => null);
    const agent = tunnel ? this.agents.get(tunnel.agent_id) : null;
    if (!tunnel || !agent) {
      edge.send({ type: 'stream_close', streamId: frame.streamId, reason: tunnel ? 'agent_offline' : 'tunnel_not_found' });
      return edge.close();
    }
    this.streams.set(frame.streamId, { edge, agentId: tunnel.agent_id });
    agent.connection.send({
      ...frame,
      targetHost: tunnel.target_host,
      targetPort: tunnel.target_port,
      protocol: tunnel.protocol,
    });
  }

  async #udpDatagram(edge, frame) {
    const tunnel = await this.#getTunnel(frame.tunnelId).catch(() => null);
    const agent = tunnel ? this.agents.get(tunnel.agent_id) : null;
    if (!tunnel || tunnel.protocol !== 'udp' || !agent) {
      edge.send({ type: 'udp_close', sessionId: frame.sessionId, reason: tunnel ? 'agent_offline' : 'tunnel_not_found' });
      return;
    }
    const sessionId = String(frame.sessionId || uuid());
    this.udpSessions.set(sessionId, { edge, agentId: tunnel.agent_id, lastSeenAt: Date.now() });
    agent.connection.send({
      ...frame,
      type: 'udp_datagram',
      sessionId,
      targetHost: tunnel.target_host,
      targetPort: tunnel.target_port,
      protocol: 'udp',
    });
  }
}

export class EdgeServer {
  constructor({ db, host = '0.0.0.0', port = 7200, relayHost = '127.0.0.1', relayPort = 7301, controlClient = null }) {
    this.db = db;
    this.host = host;
    this.port = port;
    this.relayHost = relayHost;
    this.relayPort = relayPort;
    this.controlClient = controlClient;
    this.server = null;
  }

  async start() {
    this.server = createWebServer('TUNNARA_EDGE', (req, res) => this.#handle(req, res));
    this.server.on('upgrade', (req, socket, head) => this.#upgrade(req, socket, head));
    this.server.requestTimeout = envInt('TUNNARA_EDGE_REQUEST_TIMEOUT_MS', 35000);
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, resolve);
    });
    log('edge', 'info', 'Edge HTTP ativo.', { host: this.host, port: this.port });
  }

  async stop() {
    if (!this.server) return;
    this.server.closeAllConnections?.();
    await new Promise((resolve) => this.server.close(resolve));
  }

  async #resolveHostname(hostname) {
    if (this.controlClient) return this.controlClient.resolveHostname(hostname);
    const tunnel = this.db.getTunnelByHostname(hostname);
    return tunnel ? { tunnel, presence: this.db.getAgentPresence(tunnel.agent_id) } : null;
  }

  #connectRelay(presence = null) {
    const endpoint = relayEndpoint(presence?.relay_edge_url, this.relayHost, this.relayPort);
    return new Promise((resolve, reject) => {
      const socket = endpoint.protocol === 'tls:'
        ? tls.connect({ host: endpoint.host, port: endpoint.port, servername: endpoint.servername, rejectUnauthorized: process.env.TUNNARA_INSECURE_CLUSTER_TLS !== 'true' })
        : net.connect({ host: endpoint.host, port: endpoint.port });
      socket.once('connect', () => resolve(new FramedConnection(socket)));
      socket.once('error', reject);
    });
  }

  async #handle(req, res) {
    if (req.url === '/healthz') return sendJson(res, 200, { status: 'ok', service: 'edge', version: VERSION });
    const hostname = normalizeHostname(req.headers.host);
    if (!hostname) return sendJson(res, 400, { error: 'HOST_INVALID', message: 'Host inválido.' });
    const route = await this.#resolveHostname(hostname).catch(() => null);
    const tunnel = route?.tunnel;
    if (!tunnel) return sendJson(res, 404, { error: 'TUNNEL_NOT_FOUND', message: 'Nenhum túnel ativo para este host.' });
    try {
      const body = await readRequestBody(req, envInt('TUNNARA_MAX_REQUEST_BODY_BYTES', DEFAULT_MAX_BODY));
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) headers[key] = value;
      }
      headers['x-forwarded-host'] = hostname;
      headers['x-forwarded-proto'] = this.server instanceof https.Server ? 'https' : 'http';
      headers['x-forwarded-for'] = String(req.socket.remoteAddress || '');
      const relay = await this.#connectRelay(route?.presence);
      relay.send({
        type: 'proxy_request',
        requestId: uuid(),
        tunnelId: tunnel.id,
        method: req.method,
        path: req.url,
        headers,
        bodyBase64: body.toString('base64'),
      });
      const response = await onceFrame(relay, envInt('TUNNARA_UPSTREAM_TIMEOUT_MS', 30000) + 2000);
      relay.close();
      if (response.type === 'proxy_error') return sendJson(res, response.status || 502, { error: 'UPSTREAM_ERROR', message: response.message });
      if (response.type !== 'proxy_response') return sendJson(res, 502, { error: 'PROTOCOL_ERROR', message: 'Resposta inválida do relay.' });
      const responseHeaders = {};
      for (const [key, value] of Object.entries(response.headers || {})) {
        if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'content-length') responseHeaders[key] = value;
      }
      const responseBody = Buffer.from(response.bodyBase64 || '', 'base64');
      responseHeaders['content-length'] = responseBody.length;
      responseHeaders['x-tunnara-tunnel-id'] = tunnel.id;
      res.writeHead(Number(response.status) || 502, responseHeaders);
      res.end(responseBody);
    } catch (error) {
      log('edge', 'error', 'Falha ao encaminhar requisição.', { hostname, error: error.message });
      if (!res.headersSent) sendJson(res, 502, { error: 'EDGE_PROXY_FAILED', message: error.message });
      else res.destroy(error);
    }
  }

  async #upgrade(req, client, head) {
    const hostname = normalizeHostname(req.headers.host);
    const route = hostname ? await this.#resolveHostname(hostname).catch(() => null) : null;
    const tunnel = route?.tunnel;
    if (!tunnel) {
      client.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return client.destroy();
    }
    try {
      const relay = await this.#connectRelay(route?.presence);
      const streamId = uuid();
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      const initial = Buffer.concat([Buffer.from(`${lines.join('\r\n')}\r\n\r\n`), head]);
      relay.send({ type: 'stream_open', streamId, tunnelId: tunnel.id, initialDataBase64: initial.toString('base64') });
      let opened = false;
      const timer = setTimeout(() => {
        if (!opened) {
          client.write('HTTP/1.1 504 Gateway Timeout\r\nConnection: close\r\n\r\n');
          client.destroy(); relay.destroy();
        }
      }, 10000);
      relay.on('frame', (frame) => {
        if (frame.streamId !== streamId) return;
        if (frame.type === 'stream_opened') { opened = true; clearTimeout(timer); return; }
        if (frame.type === 'stream_data') { opened = true; clearTimeout(timer); client.write(Buffer.from(frame.dataBase64 || '', 'base64')); return; }
        if (frame.type === 'stream_close') { clearTimeout(timer); client.end(); relay.close(); }
      });
      relay.on('close', () => client.destroy());
      relay.on('error', () => client.destroy());
      client.on('data', (chunk) => relay.send({ type: 'stream_data', streamId, dataBase64: chunk.toString('base64') }));
      client.on('end', () => relay.send({ type: 'stream_close', streamId, reason: 'client_end' }));
      client.on('close', () => { clearTimeout(timer); relay.send({ type: 'stream_close', streamId, reason: 'client_close' }); relay.close(); });
      client.on('error', () => relay.destroy());
    } catch (error) {
      client.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      client.destroy();
    }
  }
}

export class TcpIngressManager {
  constructor({ db, host = '0.0.0.0', relayHost = '127.0.0.1', relayPort = 7301, syncIntervalMs = 2000, controlClient = null }) {
    this.db = db;
    this.host = host;
    this.relayHost = relayHost;
    this.relayPort = relayPort;
    this.syncIntervalMs = syncIntervalMs;
    this.controlClient = controlClient;
    this.listeners = new Map();
    this.timer = null;
  }

  async start() {
    await this.sync();
    this.timer = setInterval(() => void this.sync().catch((error) => log('tcp-edge', 'error', 'Falha ao sincronizar listeners TCP.', { error: error.message })), this.syncIntervalMs);
    this.timer.unref?.();
    log('tcp-edge', 'info', 'Gerenciador de ingressos TCP ativo.', { host: this.host });
  }

  async stop() {
    clearInterval(this.timer);
    await Promise.all([...this.listeners.values()].map(({ server }) => new Promise((resolve) => server.close(resolve))));
    this.listeners.clear();
  }

  async sync() {
    const routes = this.controlClient ? (await this.controlClient.listTunnels('tcp')).data : this.db.listActiveTunnelsByProtocol('tcp').map((tunnel) => ({ tunnel, presence: this.db.getAgentPresence(tunnel.agent_id) }));
    const desired = new Map(routes.filter((route) => route.tunnel.public_port).map((route) => [Number(route.tunnel.public_port), route]));
    for (const [port, entry] of this.listeners) {
      const current = desired.get(port);
      if (!current || current.tunnel.id !== entry.route.tunnel.id) {
        await new Promise((resolve) => entry.server.close(resolve));
        this.listeners.delete(port);
        log('tcp-edge', 'info', 'Listener TCP removido.', { port, tunnelId: entry.route.tunnel.id });
      }
    }
    for (const [port, route] of desired) {
      if (this.listeners.has(port)) continue;
      const server = net.createServer((client) => this.#handleClient(client, route));
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, this.host, resolve);
      });
      server.on('error', (error) => log('tcp-edge', 'error', 'Erro no listener TCP.', { port, tunnelId: route.tunnel.id, error: error.message }));
      this.listeners.set(port, { server, route });
      log('tcp-edge', 'info', 'Listener TCP publicado.', { port, tunnelId: route.tunnel.id });
    }
  }

  #connectRelay(presence = null) {
    const endpoint = relayEndpoint(presence?.relay_edge_url, this.relayHost, this.relayPort);
    return new Promise((resolve, reject) => {
      const socket = endpoint.protocol === 'tls:'
        ? tls.connect({ host: endpoint.host, port: endpoint.port, servername: endpoint.servername, rejectUnauthorized: process.env.TUNNARA_INSECURE_CLUSTER_TLS !== 'true' })
        : net.connect({ host: endpoint.host, port: endpoint.port });
      socket.once('connect', () => resolve(new FramedConnection(socket)));
      socket.once('error', reject);
    });
  }

  async #handleClient(client, route) {
    const tunnel = route.tunnel;
    let relay = null;
    const streamId = uuid();
    try {
      relay = await this.#connectRelay(route.presence);
      let opened = false;
      const queued = [];
      relay.send({ type: 'stream_open', streamId, tunnelId: tunnel.id, initialDataBase64: '' });
      relay.on('frame', (frame) => {
        if (frame.streamId !== streamId) return;
        if (frame.type === 'stream_opened') {
          opened = true;
          for (const chunk of queued.splice(0)) relay.send({ type: 'stream_data', streamId, dataBase64: chunk.toString('base64') });
          return;
        }
        if (frame.type === 'stream_data') client.write(Buffer.from(frame.dataBase64 || '', 'base64'));
        if (frame.type === 'stream_close') { client.end(); relay.close(); }
      });
      relay.on('close', () => client.destroy());
      relay.on('error', (error) => client.destroy(error));
      client.on('data', (chunk) => {
        if (opened) relay.send({ type: 'stream_data', streamId, dataBase64: chunk.toString('base64') });
        else queued.push(Buffer.from(chunk));
      });
      client.on('end', () => relay.send({ type: 'stream_close', streamId, reason: 'client_end' }));
      client.on('close', () => { relay?.send({ type: 'stream_close', streamId, reason: 'client_close' }); relay?.close(); });
      client.on('error', () => relay?.destroy());
    } catch (error) {
      log('tcp-edge', 'warn', 'Falha ao abrir stream TCP.', { tunnelId: tunnel.id, error: error.message });
      client.destroy(error);
      relay?.destroy();
    }
  }
}

export class UdpIngressManager {
  constructor({ db, host = '0.0.0.0', relayHost = '127.0.0.1', relayPort = 7301, syncIntervalMs = 2000, idleTimeoutMs = 60000, controlClient = null }) {
    this.db = db;
    this.host = host;
    this.relayHost = relayHost;
    this.relayPort = relayPort;
    this.syncIntervalMs = syncIntervalMs;
    this.idleTimeoutMs = idleTimeoutMs;
    this.controlClient = controlClient;
    this.listeners = new Map();
    this.sessions = new Map();
    this.relays = new Map();
    this.reconnecting = new Map();
    this.timer = null;
    this.gcTimer = null;
  }

  async start() {
    if (!this.controlClient) await this.#ensureRelay();
    await this.sync();
    this.timer = setInterval(() => void this.sync().catch((error) => log('udp-edge', 'error', 'Falha ao sincronizar listeners UDP.', { error: error.message })), this.syncIntervalMs);
    this.gcTimer = setInterval(() => this.#gc(), Math.min(this.idleTimeoutMs, 15000));
    this.timer.unref?.(); this.gcTimer.unref?.();
    log('udp-edge', 'info', 'Gerenciador de ingressos UDP ativo.', { host: this.host });
  }

  async stop() {
    clearInterval(this.timer); clearInterval(this.gcTimer);
    for (const socket of this.listeners.values()) socket.close();
    this.listeners.clear(); this.sessions.clear();
    for (const relay of this.relays.values()) relay.close();
    this.relays.clear(); this.reconnecting.clear();
  }

  #relayKey(presence = null) {
    const endpoint = relayEndpoint(presence?.relay_edge_url, this.relayHost, this.relayPort);
    return { key: `${endpoint.protocol}//${endpoint.host}:${endpoint.port}`, endpoint };
  }

  async #ensureRelay(presence = null) {
    const { key, endpoint } = this.#relayKey(presence);
    const existing = this.relays.get(key);
    if (existing && !existing.socket.destroyed) return existing;
    if (this.reconnecting.has(key)) return this.reconnecting.get(key);
    const pending = new Promise((resolve, reject) => {
      const socket = endpoint.protocol === 'tls:'
        ? tls.connect({ host: endpoint.host, port: endpoint.port, servername: endpoint.servername, rejectUnauthorized: process.env.TUNNARA_INSECURE_CLUSTER_TLS !== 'true' })
        : net.connect({ host: endpoint.host, port: endpoint.port });
      socket.once('connect', () => {
        const relay = new FramedConnection(socket);
        this.relays.set(key, relay);
        relay.on('frame', (frame) => this.#onRelayFrame(frame));
        relay.on('close', () => { if (this.relays.get(key) === relay) this.relays.delete(key); });
        relay.on('error', (error) => log('udp-edge', 'warn', 'Conexão UDP com Relay falhou.', { relay: key, error: error.message }));
        resolve(relay);
      });
      socket.once('error', reject);
    }).finally(() => this.reconnecting.delete(key));
    this.reconnecting.set(key, pending);
    return pending;
  }

  async sync() {
    const routes = this.controlClient ? (await this.controlClient.listTunnels('udp')).data : this.db.listActiveTunnelsByProtocol('udp').map((tunnel) => ({ tunnel, presence: this.db.getAgentPresence(tunnel.agent_id) }));
    const desired = new Map(routes.filter((route) => route.tunnel.public_port).map((route) => [Number(route.tunnel.public_port), route]));
    for (const [port, socket] of this.listeners) {
      if (!desired.has(port)) { socket.close(); this.listeners.delete(port); }
    }
    for (const [port, route] of desired) {
      if (this.listeners.has(port)) continue;
      const socket = dgram.createSocket(this.host.includes(':') ? 'udp6' : 'udp4');
      socket.on('message', (message, remote) => void this.#onDatagram(socket, route, message, remote));
      socket.on('error', (error) => log('udp-edge', 'error', 'Erro no listener UDP.', { port, tunnelId: route.tunnel.id, error: error.message }));
      await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(port, this.host, resolve); });
      this.listeners.set(port, socket);
      log('udp-edge', 'info', 'Listener UDP publicado.', { port, tunnelId: route.tunnel.id });
    }
  }

  async #onDatagram(socket, route, message, remote) {
    const tunnel = route.tunnel;
    try {
      const relay = await this.#ensureRelay(route.presence);
      const relayKey = this.#relayKey(route.presence).key;
      const key = `${tunnel.id}|${remote.address}|${remote.port}`;
      let session = this.sessions.get(key);
      if (!session) {
        session = { id: uuid(), key, socket, tunnelId: tunnel.id, remote, relayKey, lastSeenAt: Date.now() };
        this.sessions.set(key, session);
        this.sessions.set(session.id, session);
      }
      session.lastSeenAt = Date.now();
      relay.send({ type: 'udp_datagram', sessionId: session.id, tunnelId: tunnel.id, dataBase64: message.toString('base64') });
    } catch (error) {
      log('udp-edge', 'warn', 'Falha ao encaminhar datagrama UDP.', { tunnelId: tunnel.id, error: error.message });
    }
  }

  #onRelayFrame(frame) {
    if (frame.type !== 'udp_response' && frame.type !== 'udp_close') return;
    const session = this.sessions.get(frame.sessionId);
    if (!session) return;
    if (frame.type === 'udp_response') {
      const data = Buffer.from(frame.dataBase64 || '', 'base64');
      session.socket.send(data, session.remote.port, session.remote.address);
      session.lastSeenAt = Date.now();
    } else this.#removeSession(session);
  }

  #removeSession(session) {
    this.sessions.delete(session.id);
    this.sessions.delete(session.key);
  }

  #gc() {
    const cutoff = Date.now() - this.idleTimeoutMs;
    for (const session of new Set(this.sessions.values())) {
      if (session.lastSeenAt < cutoff) {
        this.relays.get(session.relayKey)?.send({ type: 'udp_close', sessionId: session.id, reason: 'idle_timeout' });
        this.#removeSession(session);
      }
    }
  }
}
