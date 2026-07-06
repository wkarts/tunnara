import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureDir, nowIso, randomToken, sha256, slugify, uuid } from './utils.mjs';

function parseJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function ipToInt(ip) {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function intToIp(value) {
  const n = Number(value) >>> 0;
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

function cidrRange(cidr) {
  const [rawIp, rawPrefix] = String(cidr).split('/');
  const ip = ipToInt(rawIp);
  const prefix = Number(rawPrefix);
  if (ip === null || !Number.isInteger(prefix) || prefix < 8 || prefix > 30) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = ip & mask;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { network, broadcast, prefix };
}

export class TunnaraDatabase {
  constructor(file) {
    const databaseFile = String(file || '').trim() || ':memory:';
    const isMemory = databaseFile === ':memory:';
    if (!isMemory) ensureDir(path.dirname(databaseFile));
    this.file = databaseFile;
    this.driver = isMemory ? 'memory' : 'sqlite';
    this.db = new DatabaseSync(databaseFile);
    this.targetSelectionCounters = new Map();
    this.db.exec(
      isMemory
        ? 'PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;'
        : 'PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;'
    );
    this.migrate();
  }

  close() { this.db.close(); }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS api_tokens (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        scopes_json TEXT NOT NULL DEFAULT '["*"]',
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS provisioning_tokens (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        architecture TEXT NOT NULL,
        version TEXT NOT NULL,
        public_key TEXT NOT NULL,
        session_token_hash TEXT NOT NULL UNIQUE,
        session_expires_at TEXT,
        revoked_at TEXT,
        status TEXT NOT NULL DEFAULT 'offline',
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, name)
      );
      CREATE TABLE IF NOT EXISTS tunnels (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        hostname TEXT NOT NULL UNIQUE,
        target_host TEXT NOT NULL,
        target_port INTEGER NOT NULL,
        public_port INTEGER,
        transport TEXT NOT NULL DEFAULT 'auto',
        tls_mode TEXT NOT NULL DEFAULT 'automatic',
        dns_record_id TEXT,
        edge_node_id TEXT,
        relay_node_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        secret_ciphertext TEXT,
        status TEXT NOT NULL DEFAULT 'configured',
        last_tested_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, provider, name)
      );
      CREATE TABLE IF NOT EXISTS dns_records (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        integration_id TEXT REFERENCES integrations(id) ON DELETE SET NULL,
        tunnel_id TEXT REFERENCES tunnels(id) ON DELETE SET NULL,
        zone_id TEXT,
        provider_record_id TEXT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        proxied INTEGER NOT NULL DEFAULT 0,
        ttl INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, name, type)
      );
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        node_type TEXT NOT NULL,
        name TEXT NOT NULL,
        region TEXT NOT NULL DEFAULT 'default',
        public_url TEXT,
        internal_url TEXT,
        transport TEXT NOT NULL DEFAULT 'tcp',
        status TEXT NOT NULL DEFAULT 'unknown',
        capacity INTEGER NOT NULL DEFAULT 1000,
        active_connections INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (node_type, name)
      );
      CREATE TABLE IF NOT EXISTS agent_presence (
        agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
        relay_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
        relay_edge_url TEXT,
        connected_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_auth_nonces (
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        nonce TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (agent_id, nonce)
      );
      CREATE TABLE IF NOT EXISTS private_networks (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        cidr TEXT NOT NULL,
        dns_domain TEXT,
        mode TEXT NOT NULL DEFAULT 'hub-spoke',
        hub_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, name),
        UNIQUE (organization_id, cidr)
      );
      CREATE TABLE IF NOT EXISTS network_peers (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        network_id TEXT NOT NULL REFERENCES private_networks(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        virtual_ip TEXT NOT NULL,
        public_key TEXT,
        endpoint TEXT,
        allowed_ips_json TEXT NOT NULL DEFAULT '[]',
        persistent_keepalive INTEGER NOT NULL DEFAULT 25,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (network_id, agent_id),
        UNIQUE (network_id, virtual_ip)
      );
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        primary_name TEXT NOT NULL,
        san_json TEXT NOT NULL DEFAULT '[]',
        issuer TEXT NOT NULL DEFAULT 'letsencrypt',
        mode TEXT NOT NULL DEFAULT 'caddy-managed',
        status TEXT NOT NULL DEFAULT 'managed',
        expires_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, primary_name)
      );
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        document_json TEXT NOT NULL DEFAULT '{"version":"1","defaultEffect":"allow","rules":[]}',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (organization_id, name)
      );
      CREATE TABLE IF NOT EXISTS tunnel_targets (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tunnel_id TEXT NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'default',
        target_host TEXT NOT NULL,
        target_port INTEGER NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 100,
        enabled INTEGER NOT NULL DEFAULT 1,
        health_status TEXT NOT NULL DEFAULT 'unknown',
        health_check_json TEXT NOT NULL DEFAULT '{}',
        consecutive_successes INTEGER NOT NULL DEFAULT 0,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_checked_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (tunnel_id, name)
      );
      CREATE TABLE IF NOT EXISTS request_inspections (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tunnel_id TEXT NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        host TEXT NOT NULL,
        path TEXT NOT NULL,
        source_ip TEXT,
        request_headers_json TEXT NOT NULL DEFAULT '{}',
        request_body_json TEXT NOT NULL DEFAULT '{}',
        response_status INTEGER NOT NULL DEFAULT 0,
        response_headers_json TEXT NOT NULL DEFAULT '{}',
        response_body_json TEXT NOT NULL DEFAULT '{}',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER NOT NULL,
        response_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (organization_id, key)
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id TEXT,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        event TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        result TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_tunnels_org ON tunnels(organization_id);
      CREATE INDEX IF NOT EXISTS idx_tunnels_agent ON tunnels(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tunnels_host ON tunnels(hostname);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tunnels_public_port ON tunnels(protocol, public_port) WHERE public_port IS NOT NULL AND status='active';
      CREATE INDEX IF NOT EXISTS idx_dns_records_org ON dns_records(organization_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_type_status ON nodes(node_type,status);
      CREATE INDEX IF NOT EXISTS idx_network_peers_network ON network_peers(network_id);
      CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id);
      CREATE INDEX IF NOT EXISTS idx_targets_tunnel ON tunnel_targets(tunnel_id, enabled, priority, health_status);
      CREATE INDEX IF NOT EXISTS idx_targets_agent ON tunnel_targets(agent_id);
      CREATE INDEX IF NOT EXISTS idx_inspections_tunnel_created ON request_inspections(tunnel_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inspections_org_created ON request_inspections(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs(organization_id, created_at DESC);
    `);
    const addColumn = (table, name, definition) => {
      const columns = new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
      if (!columns.has(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    };
    addColumn('agents', 'session_expires_at', 'TEXT');
    addColumn('agents', 'revoked_at', 'TEXT');
    addColumn('tunnels', 'public_port', 'INTEGER');
    addColumn('tunnels', 'transport', "TEXT NOT NULL DEFAULT 'auto'");
    addColumn('tunnels', 'tls_mode', "TEXT NOT NULL DEFAULT 'automatic'");
    addColumn('tunnels', 'dns_record_id', 'TEXT');
    addColumn('tunnels', 'edge_node_id', 'TEXT');
    addColumn('tunnels', 'relay_node_id', 'TEXT');
    addColumn('tunnels', 'policy_id', 'TEXT');
    addColumn('tunnels', 'inspector_enabled', 'INTEGER NOT NULL DEFAULT 0');
    addColumn('tunnels', 'inspector_body_limit', 'INTEGER NOT NULL DEFAULT 65536');
    addColumn('tunnels', 'health_status', "TEXT NOT NULL DEFAULT 'unknown'");
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT OR IGNORE INTO tunnel_targets (
        id,organization_id,tunnel_id,agent_id,name,target_host,target_port,weight,priority,enabled,
        health_status,health_check_json,created_at,updated_at
      )
      SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' ||
             substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
             organization_id,id,agent_id,'default',target_host,target_port,1,100,1,'unknown','{}',?,?
      FROM tunnels
      WHERE NOT EXISTS (SELECT 1 FROM tunnel_targets tt WHERE tt.tunnel_id=tunnels.id)
    `).run(timestamp, timestamp);
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = callback();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  hasOrganizations() {
    return Number(this.db.prepare('SELECT COUNT(*) AS total FROM organizations').get().total) > 0;
  }

  bootstrap(organizationName, explicitToken = '') {
    if (this.hasOrganizations()) return { created: false };
    const organizationId = uuid();
    const token = explicitToken || randomToken('tnr_admin');
    const timestamp = nowIso();
    this.transaction(() => {
      this.db.prepare('INSERT INTO organizations (id,name,slug,created_at) VALUES (?,?,?,?)')
        .run(organizationId, organizationName, slugify(organizationName), timestamp);
      this.db.prepare('INSERT INTO api_tokens (id,organization_id,name,token_hash,scopes_json,created_at) VALUES (?,?,?,?,?,?)')
        .run(uuid(), organizationId, 'Bootstrap administrator', sha256(token), '["*"]', timestamp);
      this.audit(organizationId, 'system', null, 'organization.bootstrapped', 'organization', organizationId, 'success', {});
    });
    return { created: true, organizationId, token };
  }

  authenticateApiToken(rawToken) {
    if (!rawToken) return null;
    return this.db.prepare(`
      SELECT t.id AS token_id, t.organization_id, t.name, t.scopes_json, o.name AS organization_name
      FROM api_tokens t JOIN organizations o ON o.id=t.organization_id
      WHERE t.token_hash=? AND t.revoked_at IS NULL
    `).get(sha256(rawToken)) ?? null;
  }

  createApiToken(organizationId, name, scopes = ['*']) {
    const rawToken = randomToken('tnr_admin');
    const id = uuid();
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO api_tokens (id,organization_id,name,token_hash,scopes_json,created_at)
      VALUES (?,?,?,?,?,?)
    `).run(id, organizationId, name, sha256(rawToken), JSON.stringify(scopes), timestamp);
    this.audit(organizationId, 'api_token', null, 'api_token.created', 'api_token', id, 'success', { name, scopes });
    return { id, name, token: rawToken, scopes, createdAt: timestamp };
  }

  listApiTokens(organizationId) {
    return this.db.prepare(`
      SELECT id,name,scopes_json,created_at,revoked_at
      FROM api_tokens WHERE organization_id=? ORDER BY created_at DESC
    `).all(organizationId).map((row) => ({
      id: row.id, name: row.name, scopes: parseJson(row.scopes_json, []),
      createdAt: row.created_at, revokedAt: row.revoked_at,
    }));
  }

  revokeApiToken(organizationId, id) {
    const row = this.db.prepare('SELECT id FROM api_tokens WHERE id=? AND organization_id=? AND revoked_at IS NULL').get(id, organizationId);
    if (!row) return false;
    this.db.prepare('UPDATE api_tokens SET revoked_at=? WHERE id=?').run(nowIso(), id);
    this.audit(organizationId, 'api_token', null, 'api_token.revoked', 'api_token', id, 'success', {});
    return true;
  }

  authenticateAgentToken(rawToken) {
    if (!rawToken) return null;
    return this.db.prepare(`
      SELECT a.*, o.name AS organization_name
      FROM agents a JOIN organizations o ON o.id=a.organization_id
      WHERE a.session_token_hash=? AND a.revoked_at IS NULL AND (a.session_expires_at IS NULL OR a.session_expires_at>?)
    `).get(sha256(rawToken), nowIso()) ?? null;
  }

  createProvisioningToken(organizationId, name = 'Novo agente', ttlSeconds = 900) {
    const rawToken = randomToken('tnr_prov');
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO provisioning_tokens (id,organization_id,token_hash,name,expires_at,created_at)
      VALUES (?,?,?,?,?,?)
    `).run(uuid(), organizationId, sha256(rawToken), name, expiresAt, createdAt);
    this.audit(organizationId, 'api_token', null, 'provisioning_token.created', 'provisioning_token', null, 'success', { name, expiresAt });
    return { token: rawToken, expiresAt };
  }

  consumeProvisioningToken(rawToken) {
    const tokenHash = sha256(rawToken);
    return this.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM provisioning_tokens
        WHERE token_hash=? AND used_at IS NULL AND expires_at>?
      `).get(tokenHash, nowIso());
      if (!row) return null;
      this.db.prepare('UPDATE provisioning_tokens SET used_at=? WHERE id=? AND used_at IS NULL').run(nowIso(), row.id);
      return row;
    });
  }

  registerAgent(provisioningToken, payload) {
    const provision = this.consumeProvisioningToken(provisioningToken);
    if (!provision) {
      const error = new Error('Token de provisionamento inválido, expirado ou já utilizado.');
      error.statusCode = 401;
      error.code = 'PROVISIONING_TOKEN_INVALID';
      throw error;
    }
    const id = uuid();
    const sessionToken = randomToken('tnr_agent');
    const timestamp = nowIso();
    const sessionExpiresAt = new Date(Date.now() + 90 * 86400 * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO agents (id,organization_id,name,platform,architecture,version,public_key,session_token_hash,session_expires_at,status,last_seen_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, provision.organization_id, payload.name, payload.platform, payload.architecture,
      payload.version, payload.publicKey, sha256(sessionToken), sessionExpiresAt, 'offline', timestamp, timestamp, timestamp,
    );
    this.audit(provision.organization_id, 'provisioning_token', provision.id, 'agent.registered', 'agent', id, 'success', { name: payload.name });
    return { id, organizationId: provision.organization_id, sessionToken, sessionExpiresAt, heartbeatIntervalSeconds: 20 };
  }

  touchAgent(agentId, status = 'online') {
    const timestamp = nowIso();
    this.db.prepare('UPDATE agents SET status=?, last_seen_at=?, updated_at=? WHERE id=?').run(status, timestamp, timestamp, agentId);
    this.db.prepare('UPDATE agent_presence SET last_seen_at=? WHERE agent_id=?').run(timestamp, agentId);
  }

  markAgentOffline(agentId) {
    this.db.prepare('UPDATE agents SET status=?, updated_at=? WHERE id=?').run('offline', nowIso(), agentId);
    this.db.prepare('DELETE FROM agent_presence WHERE agent_id=?').run(agentId);
  }

  revokeAgent(organizationId, id) {
    const agent = this.db.prepare('SELECT id FROM agents WHERE id=? AND organization_id=?').get(id, organizationId);
    if (!agent) return false;
    const timestamp = nowIso();
    this.db.prepare("UPDATE agents SET revoked_at=?, status='revoked', updated_at=? WHERE id=?").run(timestamp, timestamp, id);
    this.db.prepare('DELETE FROM agent_presence WHERE agent_id=?').run(id);
    this.audit(organizationId, 'api_token', null, 'agent.revoked', 'agent', id, 'success', {});
    return true;
  }

  listAgents(organizationId) {
    return this.db.prepare(`
      SELECT id,name,platform,architecture,version,status,last_seen_at,created_at
      FROM agents WHERE organization_id=? ORDER BY created_at DESC
    `).all(organizationId);
  }

  getAgent(id) { return this.db.prepare('SELECT * FROM agents WHERE id=?').get(id) ?? null; }

  allocatePublicPort(protocol, minPort = 20000, maxPort = 40000) {
    const used = new Set(this.db.prepare(`SELECT public_port FROM tunnels WHERE protocol=? AND status='active' AND public_port IS NOT NULL`).all(protocol)
      .map((row) => Number(row.public_port)));
    for (let port = minPort; port <= maxPort; port += 1) if (!used.has(port)) return port;
    const error = new Error(`Nenhuma porta pública disponível entre ${minPort} e ${maxPort}.`);
    error.code = 'PUBLIC_PORT_EXHAUSTED';
    error.statusCode = 409;
    throw error;
  }

  createTunnel({
    organizationId, agentId, name, protocol = 'http', hostname, targetHost = '127.0.0.1', targetPort,
    publicPort = null, transport = 'auto', tlsMode = 'automatic', edgeNodeId = null, relayNodeId = null,
    policyId = null, inspectorEnabled = false, inspectorBodyLimit = 65536, targets = null,
  }) {
    const primaryAgent = this.db.prepare('SELECT id,organization_id FROM agents WHERE id=?').get(agentId);
    if (!primaryAgent || primaryAgent.organization_id !== organizationId) {
      const error = new Error('Agente não pertence à organização autenticada.');
      error.statusCode = 422;
      error.code = 'AGENT_ORGANIZATION_MISMATCH';
      throw error;
    }
    if (policyId) {
      const policy = this.getPolicy(organizationId, policyId);
      if (!policy) {
        const error = new Error('Política informada não pertence à organização autenticada.');
        error.statusCode = 422; error.code = 'POLICY_ORGANIZATION_MISMATCH'; throw error;
      }
    }
    const id = uuid();
    const timestamp = nowIso();
    const effectiveHostname = hostname || `${protocol}-${id}.internal.tunnara`;
    const targetList = Array.isArray(targets) && targets.length ? targets : [{
      name: 'default', agentId, targetHost, targetPort, weight: 1, priority: 100,
      healthCheck: ['http', 'https'].includes(protocol) ? { type: 'http', path: '/healthz', intervalSeconds: 30, timeoutSeconds: 5, healthyThreshold: 2, unhealthyThreshold: 3 } : { type: 'tcp', intervalSeconds: 30, timeoutSeconds: 5, healthyThreshold: 2, unhealthyThreshold: 3 },
    }];
    for (const target of targetList) {
      const targetAgent = this.db.prepare('SELECT id,organization_id FROM agents WHERE id=?').get(target.agentId || agentId);
      if (!targetAgent || targetAgent.organization_id !== organizationId) {
        const error = new Error(`Target ${target.name || 'sem nome'} usa agente de outra organização.`);
        error.statusCode = 422; error.code = 'TARGET_AGENT_ORGANIZATION_MISMATCH'; throw error;
      }
    }
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO tunnels (
          id,organization_id,agent_id,name,protocol,hostname,target_host,target_port,public_port,transport,tls_mode,
          edge_node_id,relay_node_id,policy_id,inspector_enabled,inspector_body_limit,health_status,status,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        id, organizationId, agentId, name, protocol, effectiveHostname, targetHost, targetPort,
        publicPort, transport, tlsMode, edgeNodeId, relayNodeId, policyId, inspectorEnabled ? 1 : 0,
        Math.max(0, Number(inspectorBodyLimit || 65536)), 'unknown', 'active', timestamp, timestamp,
      );
      for (const [index, target] of targetList.entries()) {
        this.createTunnelTarget({
          organizationId, tunnelId: id, agentId: target.agentId || agentId,
          name: target.name || `target-${index + 1}`, targetHost: target.targetHost || target.host || targetHost,
          targetPort: Number(target.targetPort || target.port || targetPort), weight: Number(target.weight || 1),
          priority: Number(target.priority ?? 100), enabled: target.enabled !== false,
          healthCheck: target.healthCheck || {}, audit: false,
        });
      }
      this.audit(organizationId, 'agent', agentId, 'tunnel.created', 'tunnel', id, 'success', {
        protocol, hostname: effectiveHostname, publicPort, transport, targets: targetList.length,
      });
    });
    return this.getTunnelWithTargets(organizationId, id);
  }

  getTunnel(id) { return this.db.prepare('SELECT * FROM tunnels WHERE id=?').get(id) ?? null; }
  getTunnelWithTargets(organizationId, id) {
    const tunnel = this.db.prepare('SELECT * FROM tunnels WHERE id=? AND organization_id=?').get(id, organizationId);
    if (!tunnel) return null;
    return { ...tunnel, targets: this.listTunnelTargets(organizationId, id), policy: tunnel.policy_id ? this.getPolicy(organizationId, tunnel.policy_id) : null };
  }
  getTunnelByHostname(hostname) {
    return this.db.prepare(`
      SELECT t.*, a.status AS agent_status FROM tunnels t JOIN agents a ON a.id=t.agent_id
      WHERE t.hostname=? AND t.status='active'
    `).get(hostname) ?? null;
  }
  getTunnelByPublicPort(protocol, publicPort) {
    return this.db.prepare(`
      SELECT t.*, a.status AS agent_status FROM tunnels t JOIN agents a ON a.id=t.agent_id
      WHERE t.protocol=? AND t.public_port=? AND t.status='active'
    `).get(protocol, publicPort) ?? null;
  }
  listTunnels(organizationId, agentId = null) {
    const rows = agentId
      ? this.db.prepare('SELECT * FROM tunnels WHERE organization_id=? AND agent_id=? ORDER BY created_at DESC').all(organizationId, agentId)
      : this.db.prepare('SELECT * FROM tunnels WHERE organization_id=? ORDER BY created_at DESC').all(organizationId);
    return rows.map((row) => ({ ...row, targets: this.listTunnelTargets(organizationId, row.id) }));
  }
  listAllActiveTunnels() { return this.db.prepare("SELECT * FROM tunnels WHERE status='active' ORDER BY created_at DESC").all(); }
  listActiveTunnelsByProtocol(protocol) {
    return this.db.prepare("SELECT * FROM tunnels WHERE protocol=? AND status='active' ORDER BY public_port").all(protocol);
  }
  setTunnelDnsRecord(tunnelId, dnsRecordId) {
    this.db.prepare('UPDATE tunnels SET dns_record_id=?, updated_at=? WHERE id=?').run(dnsRecordId, nowIso(), tunnelId);
  }
  updateTunnel(organizationId, id, changes = {}) {
    const tunnel = this.db.prepare('SELECT * FROM tunnels WHERE id=? AND organization_id=?').get(id, organizationId);
    if (!tunnel) return null;
    const allowed = {
      name: changes.name, status: changes.status, policy_id: changes.policyId,
      inspector_enabled: changes.inspectorEnabled === undefined ? undefined : (changes.inspectorEnabled ? 1 : 0),
      inspector_body_limit: changes.inspectorBodyLimit,
      transport: changes.transport, tls_mode: changes.tlsMode,
    };
    if (allowed.policy_id) {
      const policy = this.getPolicy(organizationId, allowed.policy_id);
      if (!policy) throw Object.assign(new Error('Política não encontrada.'), { statusCode: 422, code: 'POLICY_NOT_FOUND' });
    }
    const entries = Object.entries(allowed).filter(([, value]) => value !== undefined);
    if (entries.length) {
      const sql = entries.map(([key]) => `${key}=?`).join(',');
      this.db.prepare(`UPDATE tunnels SET ${sql},updated_at=? WHERE id=? AND organization_id=?`)
        .run(...entries.map(([, value]) => value), nowIso(), id, organizationId);
    }
    return this.getTunnelWithTargets(organizationId, id);
  }
  deleteTunnel(organizationId, id, agentId = null) {
    const tunnel = this.getTunnel(id);
    if (!tunnel || tunnel.organization_id !== organizationId || (agentId && tunnel.agent_id !== agentId)) return false;
    this.db.prepare('DELETE FROM tunnels WHERE id=?').run(id);
    this.audit(organizationId, agentId ? 'agent' : 'api_token', agentId, 'tunnel.deleted', 'tunnel', id, 'success', {});
    return tunnel;
  }

  createPolicy({ organizationId, name, description = '', document = {}, enabled = true }) {
    const id = uuid(); const timestamp = nowIso();
    this.db.prepare('INSERT INTO policies (id,organization_id,name,description,document_json,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, organizationId, name, description, JSON.stringify(document), enabled ? 1 : 0, timestamp, timestamp);
    this.audit(organizationId, 'api_token', null, 'policy.created', 'policy', id, 'success', { name });
    return this.getPolicy(organizationId, id);
  }
  getPolicy(organizationId, id) {
    const row = this.db.prepare('SELECT * FROM policies WHERE organization_id=? AND id=?').get(organizationId, id);
    return row ? { ...row, enabled: Boolean(row.enabled), document: parseJson(row.document_json, {}) } : null;
  }
  listPolicies(organizationId) {
    return this.db.prepare('SELECT * FROM policies WHERE organization_id=? ORDER BY name').all(organizationId)
      .map((row) => ({ ...row, enabled: Boolean(row.enabled), document: parseJson(row.document_json, {}) }));
  }
  updatePolicy(organizationId, id, changes = {}) {
    const current = this.getPolicy(organizationId, id); if (!current) return null;
    this.db.prepare('UPDATE policies SET name=?,description=?,document_json=?,enabled=?,updated_at=? WHERE organization_id=? AND id=?')
      .run(changes.name ?? current.name, changes.description ?? current.description, JSON.stringify(changes.document ?? current.document),
        changes.enabled === undefined ? (current.enabled ? 1 : 0) : (changes.enabled ? 1 : 0), nowIso(), organizationId, id);
    this.audit(organizationId, 'api_token', null, 'policy.updated', 'policy', id, 'success', {});
    return this.getPolicy(organizationId, id);
  }
  deletePolicy(organizationId, id) {
    const used = Number(this.db.prepare('SELECT COUNT(*) AS total FROM tunnels WHERE organization_id=? AND policy_id=?').get(organizationId, id).total);
    if (used) throw Object.assign(new Error('Política está associada a túneis ativos.'), { statusCode: 409, code: 'POLICY_IN_USE' });
    const result = this.db.prepare('DELETE FROM policies WHERE organization_id=? AND id=?').run(organizationId, id);
    if (result.changes) this.audit(organizationId, 'api_token', null, 'policy.deleted', 'policy', id, 'success', {});
    return Boolean(result.changes);
  }

  createTunnelTarget({ organizationId, tunnelId, agentId, name = 'default', targetHost = '127.0.0.1', targetPort, weight = 1, priority = 100, enabled = true, healthCheck = {}, audit = true }) {
    const tunnel = this.db.prepare('SELECT id FROM tunnels WHERE id=? AND organization_id=?').get(tunnelId, organizationId);
    const agent = this.db.prepare('SELECT id FROM agents WHERE id=? AND organization_id=?').get(agentId, organizationId);
    if (!tunnel || !agent) throw Object.assign(new Error('Túnel ou agente do target não pertence à organização.'), { statusCode: 422, code: 'TARGET_REFERENCE_INVALID' });
    const id = uuid(); const timestamp = nowIso();
    this.db.prepare(`INSERT INTO tunnel_targets (id,organization_id,tunnel_id,agent_id,name,target_host,target_port,weight,priority,enabled,health_status,health_check_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, organizationId, tunnelId, agentId, name, targetHost, Number(targetPort), Math.max(1, Number(weight || 1)), Number(priority || 100), enabled ? 1 : 0, 'unknown', JSON.stringify(healthCheck || {}), timestamp, timestamp);
    if (audit) this.audit(organizationId, 'api_token', null, 'tunnel_target.created', 'tunnel_target', id, 'success', { tunnelId, agentId });
    return this.getTunnelTarget(organizationId, id);
  }
  getTunnelTarget(organizationId, id) {
    const row = this.db.prepare('SELECT * FROM tunnel_targets WHERE organization_id=? AND id=?').get(organizationId, id);
    return row ? { ...row, enabled: Boolean(row.enabled), health_check: parseJson(row.health_check_json, {}) } : null;
  }
  listTunnelTargets(organizationId, tunnelId) {
    return this.db.prepare('SELECT * FROM tunnel_targets WHERE organization_id=? AND tunnel_id=? ORDER BY priority,name').all(organizationId, tunnelId)
      .map((row) => ({ ...row, enabled: Boolean(row.enabled), health_check: parseJson(row.health_check_json, {}) }));
  }
  updateTunnelTarget(organizationId, id, changes = {}) {
    const current = this.getTunnelTarget(organizationId, id); if (!current) return null;
    if (changes.agentId) {
      const agent = this.db.prepare('SELECT id FROM agents WHERE id=? AND organization_id=?').get(changes.agentId, organizationId);
      if (!agent) throw Object.assign(new Error('Agente do target não pertence à organização.'), { statusCode: 422, code: 'TARGET_AGENT_INVALID' });
    }
    this.db.prepare(`UPDATE tunnel_targets SET agent_id=?,name=?,target_host=?,target_port=?,weight=?,priority=?,enabled=?,health_check_json=?,updated_at=? WHERE organization_id=? AND id=?`)
      .run(changes.agentId ?? current.agent_id, changes.name ?? current.name, changes.targetHost ?? current.target_host,
        Number(changes.targetPort ?? current.target_port), Math.max(1, Number(changes.weight ?? current.weight)), Number(changes.priority ?? current.priority),
        changes.enabled === undefined ? (current.enabled ? 1 : 0) : (changes.enabled ? 1 : 0), JSON.stringify(changes.healthCheck ?? current.health_check),
        nowIso(), organizationId, id);
    this.audit(organizationId, 'api_token', null, 'tunnel_target.updated', 'tunnel_target', id, 'success', {});
    return this.getTunnelTarget(organizationId, id);
  }
  deleteTunnelTarget(organizationId, id) {
    const target = this.getTunnelTarget(organizationId, id); if (!target) return false;
    const total = Number(this.db.prepare('SELECT COUNT(*) AS total FROM tunnel_targets WHERE tunnel_id=?').get(target.tunnel_id).total);
    if (total <= 1) throw Object.assign(new Error('Um túnel deve manter pelo menos um target.'), { statusCode: 409, code: 'LAST_TARGET' });
    this.db.prepare('DELETE FROM tunnel_targets WHERE organization_id=? AND id=?').run(organizationId, id);
    this.audit(organizationId, 'api_token', null, 'tunnel_target.deleted', 'tunnel_target', id, 'success', {});
    return target;
  }
  updateTargetHealth(id, { healthy, error = null, latencyMs = null }) {
    const current = this.db.prepare('SELECT * FROM tunnel_targets WHERE id=?').get(id); if (!current) return null;
    const health = parseJson(current.health_check_json, {});
    const healthyThreshold = Math.max(1, Number(health.healthyThreshold || 2));
    const unhealthyThreshold = Math.max(1, Number(health.unhealthyThreshold || 3));
    const successes = healthy ? Number(current.consecutive_successes || 0) + 1 : 0;
    const failures = healthy ? 0 : Number(current.consecutive_failures || 0) + 1;
    let status = current.health_status;
    if (healthy && successes >= healthyThreshold) status = 'healthy';
    if (!healthy && failures >= unhealthyThreshold) status = 'unhealthy';
    this.db.prepare('UPDATE tunnel_targets SET health_status=?,consecutive_successes=?,consecutive_failures=?,last_checked_at=?,last_error=?,updated_at=? WHERE id=?')
      .run(status, successes, failures, nowIso(), error, nowIso(), id);
    this.db.prepare(`UPDATE tunnels SET health_status=(CASE
      WHEN EXISTS(SELECT 1 FROM tunnel_targets WHERE tunnel_id=? AND enabled=1 AND health_status='healthy') THEN 'healthy'
      WHEN EXISTS(SELECT 1 FROM tunnel_targets WHERE tunnel_id=? AND enabled=1 AND health_status='unknown') THEN 'unknown'
      ELSE 'unhealthy' END),updated_at=? WHERE id=?`).run(current.tunnel_id, current.tunnel_id, nowIso(), current.tunnel_id);
    return { ...this.getTunnelTarget(current.organization_id, id), latencyMs };
  }
  listTargetsForHealthCheck() {
    return this.db.prepare(`SELECT tt.*,t.protocol,t.status AS tunnel_status FROM tunnel_targets tt JOIN tunnels t ON t.id=tt.tunnel_id
      WHERE tt.enabled=1 AND t.status='active' ORDER BY COALESCE(tt.last_checked_at,'')`).all()
      .map((row) => ({ ...row, enabled: Boolean(row.enabled), health_check: parseJson(row.health_check_json, {}) }));
  }
  selectTunnelTarget(tunnelId, requestedTargetId = null) {
    let targets = this.db.prepare(`SELECT tt.*,a.status AS agent_status FROM tunnel_targets tt JOIN agents a ON a.id=tt.agent_id
      WHERE tt.tunnel_id=? AND tt.enabled=1 AND a.revoked_at IS NULL ORDER BY tt.priority,tt.name`).all(tunnelId);
    if (requestedTargetId) targets = targets.filter((target) => target.id === requestedTargetId);
    if (!targets.length) return null;
    const healthy = targets.filter((target) => target.health_status === 'healthy' && target.agent_status === 'online');
    const unknown = targets.filter((target) => target.health_status === 'unknown' && target.agent_status === 'online');
    const eligible = healthy.length ? healthy : unknown.length ? unknown : targets.filter((target) => target.agent_status === 'online');
    if (!eligible.length) return null;
    const priority = Math.min(...eligible.map((target) => Number(target.priority || 100)));
    const tier = eligible.filter((target) => Number(target.priority || 100) === priority);
    const weighted = tier.flatMap((target) => Array.from({ length: Math.min(100, Math.max(1, Number(target.weight || 1))) }, () => target));
    const cursor = Number(this.targetSelectionCounters.get(tunnelId) || 0);
    this.targetSelectionCounters.set(tunnelId, cursor + 1);
    const selected = weighted[cursor % weighted.length];
    return { ...selected, enabled: Boolean(selected.enabled), health_check: parseJson(selected.health_check_json, {}) };
  }
  resolveTunnelByHostname(hostname, requestedTargetId = null) {
    const tunnel = this.getTunnelByHostname(hostname); if (!tunnel) return null;
    const target = this.selectTunnelTarget(tunnel.id, requestedTargetId); if (!target) return { tunnel, target: null, presence: null };
    return { tunnel, target, presence: this.getAgentPresence(target.agent_id), policy: tunnel.policy_id ? this.getPolicy(tunnel.organization_id, tunnel.policy_id) : null };
  }
  resolveTunnelById(id, requestedTargetId = null) {
    const tunnel = this.getTunnel(id); if (!tunnel) return null;
    const target = this.selectTunnelTarget(tunnel.id, requestedTargetId); if (!target) return { tunnel, target: null, presence: null };
    return { tunnel, target, presence: this.getAgentPresence(target.agent_id), policy: tunnel.policy_id ? this.getPolicy(tunnel.organization_id, tunnel.policy_id) : null };
  }
  listActiveTunnelRoutesByProtocol(protocol) {
    return this.listActiveTunnelsByProtocol(protocol).map((tunnel) => this.resolveTunnelById(tunnel.id)).filter(Boolean);
  }

  saveInspection(record) {
    this.db.prepare(`INSERT INTO request_inspections (id,organization_id,tunnel_id,method,host,path,source_ip,request_headers_json,request_body_json,response_status,response_headers_json,response_body_json,duration_ms,error,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(record.id, record.organizationId, record.tunnelId, record.method, record.host, record.path, record.sourceIp,
        JSON.stringify(record.requestHeaders || {}), JSON.stringify(record.requestBody || {}), Number(record.responseStatus || 0),
        JSON.stringify(record.responseHeaders || {}), JSON.stringify(record.responseBody || {}), Number(record.durationMs || 0), record.error || null, nowIso());
    return this.getInspection(record.organizationId, record.id);
  }
  getInspection(organizationId, id) {
    const row = this.db.prepare('SELECT * FROM request_inspections WHERE organization_id=? AND id=?').get(organizationId, id);
    return row ? { ...row, request_headers: parseJson(row.request_headers_json, {}), request_body: parseJson(row.request_body_json, {}), response_headers: parseJson(row.response_headers_json, {}), response_body: parseJson(row.response_body_json, {}) } : null;
  }
  listInspections(organizationId, { tunnelId = null, limit = 100, offset = 0 } = {}) {
    const rows = tunnelId
      ? this.db.prepare('SELECT * FROM request_inspections WHERE organization_id=? AND tunnel_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(organizationId, tunnelId, limit, offset)
      : this.db.prepare('SELECT * FROM request_inspections WHERE organization_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(organizationId, limit, offset);
    return rows.map((row) => ({ ...row, request_headers: parseJson(row.request_headers_json, {}), request_body: parseJson(row.request_body_json, {}), response_headers: parseJson(row.response_headers_json, {}), response_body: parseJson(row.response_body_json, {}) }));
  }
  deleteInspection(organizationId, id) { return Boolean(this.db.prepare('DELETE FROM request_inspections WHERE organization_id=? AND id=?').run(organizationId, id).changes); }
  purgeInspections(organizationId, olderThanIso = null) {
    const result = olderThanIso
      ? this.db.prepare('DELETE FROM request_inspections WHERE organization_id=? AND created_at<?').run(organizationId, olderThanIso)
      : this.db.prepare('DELETE FROM request_inspections WHERE organization_id=?').run(organizationId);
    return Number(result.changes || 0);
  }

  pruneRuntimeData({ inspectorRetentionDays = 7, inspectorMaxRecords = 10000, auditRetentionDays = 90 } = {}) {
    const result = { inspectionsByAge: 0, inspectionsByLimit: 0, auditByAge: 0, idempotencyExpired: 0 };
    const now = nowIso();
    result.idempotencyExpired = Number(this.db.prepare('DELETE FROM idempotency_keys WHERE expires_at<=?').run(now).changes || 0);
    if (Number(inspectorRetentionDays) > 0) {
      const cutoff = new Date(Date.now() - Number(inspectorRetentionDays) * 86400000).toISOString();
      result.inspectionsByAge = Number(this.db.prepare('DELETE FROM request_inspections WHERE created_at<?').run(cutoff).changes || 0);
    }
    const maxRecords = Math.max(0, Number(inspectorMaxRecords || 0));
    if (maxRecords > 0) {
      const organizations = this.db.prepare('SELECT DISTINCT organization_id FROM request_inspections').all();
      const stale = this.db.prepare('SELECT id FROM request_inspections WHERE organization_id=? ORDER BY created_at DESC LIMIT -1 OFFSET ?');
      const remove = this.db.prepare('DELETE FROM request_inspections WHERE id=?');
      for (const organization of organizations) {
        for (const row of stale.all(organization.organization_id, maxRecords)) result.inspectionsByLimit += Number(remove.run(row.id).changes || 0);
      }
    }
    if (Number(auditRetentionDays) > 0) {
      const cutoff = new Date(Date.now() - Number(auditRetentionDays) * 86400000).toISOString();
      result.auditByAge = Number(this.db.prepare('DELETE FROM audit_logs WHERE created_at<?').run(cutoff).changes || 0);
    }
    return result;
  }

  getIdempotentResponse(organizationId, key, requestHash) {
    this.db.prepare('DELETE FROM idempotency_keys WHERE expires_at<=?').run(nowIso());
    const row = this.db.prepare('SELECT * FROM idempotency_keys WHERE organization_id=? AND key=?').get(organizationId, key);
    if (!row) return null;
    if (row.request_hash !== requestHash) throw Object.assign(new Error('Idempotency-Key reutilizada com payload diferente.'), { statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });
    return { status: row.response_status, body: parseJson(row.response_json, {}) };
  }
  saveIdempotentResponse(organizationId, key, requestHash, status, body, ttlSeconds = 86400) {
    const timestamp = nowIso(); const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    this.db.prepare(`INSERT INTO idempotency_keys (organization_id,key,request_hash,response_status,response_json,expires_at,created_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(organization_id,key) DO UPDATE SET request_hash=excluded.request_hash,response_status=excluded.response_status,response_json=excluded.response_json,expires_at=excluded.expires_at`)
      .run(organizationId, key, requestHash, status, JSON.stringify(body), expiresAt, timestamp);
  }

  upsertIntegration({ organizationId, provider, name = 'default', config = {}, secretCiphertext = null, status = 'configured' }) {
    const existing = this.db.prepare('SELECT * FROM integrations WHERE organization_id=? AND provider=? AND name=?').get(organizationId, provider, name);
    const timestamp = nowIso();
    if (existing) {
      this.db.prepare(`UPDATE integrations SET config_json=?,secret_ciphertext=COALESCE(?,secret_ciphertext),status=?,updated_at=? WHERE id=?`)
        .run(JSON.stringify(config), secretCiphertext, status, timestamp, existing.id);
      this.audit(organizationId, 'api_token', null, 'integration.updated', 'integration', existing.id, 'success', { provider, name });
      return this.getIntegration(organizationId, provider, name);
    }
    const id = uuid();
    this.db.prepare(`INSERT INTO integrations (id,organization_id,provider,name,config_json,secret_ciphertext,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, organizationId, provider, name, JSON.stringify(config), secretCiphertext, status, timestamp, timestamp);
    this.audit(organizationId, 'api_token', null, 'integration.created', 'integration', id, 'success', { provider, name });
    return this.getIntegration(organizationId, provider, name);
  }
  getIntegration(organizationId, provider, name = 'default') {
    const row = this.db.prepare('SELECT * FROM integrations WHERE organization_id=? AND provider=? AND name=?').get(organizationId, provider, name);
    return row ? { ...row, config: parseJson(row.config_json, {}) } : null;
  }
  getIntegrationById(organizationId, id) {
    const row = this.db.prepare('SELECT * FROM integrations WHERE organization_id=? AND id=?').get(organizationId, id);
    return row ? { ...row, config: parseJson(row.config_json, {}) } : null;
  }
  listIntegrations(organizationId) {
    return this.db.prepare('SELECT id,provider,name,config_json,status,last_tested_at,last_error,created_at,updated_at FROM integrations WHERE organization_id=? ORDER BY provider,name')
      .all(organizationId).map((row) => ({ ...row, config: parseJson(row.config_json, {}) }));
  }
  updateIntegrationTest(id, ok, errorMessage = null) {
    this.db.prepare('UPDATE integrations SET status=?,last_tested_at=?,last_error=?,updated_at=? WHERE id=?')
      .run(ok ? 'active' : 'error', nowIso(), errorMessage, nowIso(), id);
  }

  saveDnsRecord({ organizationId, integrationId = null, tunnelId = null, zoneId = null, providerRecordId = null, type, name, content, proxied = false, ttl = 1, status = 'active' }) {
    const timestamp = nowIso();
    const existing = this.db.prepare('SELECT id FROM dns_records WHERE organization_id=? AND name=? AND type=?').get(organizationId, name, type);
    if (existing) {
      this.db.prepare(`UPDATE dns_records SET integration_id=?,tunnel_id=?,zone_id=?,provider_record_id=?,content=?,proxied=?,ttl=?,status=?,updated_at=? WHERE id=?`)
        .run(integrationId, tunnelId, zoneId, providerRecordId, content, proxied ? 1 : 0, ttl, status, timestamp, existing.id);
      return this.getDnsRecord(organizationId, existing.id);
    }
    const id = uuid();
    this.db.prepare(`INSERT INTO dns_records (id,organization_id,integration_id,tunnel_id,zone_id,provider_record_id,type,name,content,proxied,ttl,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, organizationId, integrationId, tunnelId, zoneId, providerRecordId, type, name, content, proxied ? 1 : 0, ttl, status, timestamp, timestamp);
    return this.getDnsRecord(organizationId, id);
  }
  getDnsRecord(organizationId, id) { return this.db.prepare('SELECT * FROM dns_records WHERE organization_id=? AND id=?').get(organizationId, id) ?? null; }
  listDnsRecords(organizationId) { return this.db.prepare('SELECT * FROM dns_records WHERE organization_id=? ORDER BY created_at DESC').all(organizationId); }
  deleteDnsRecord(organizationId, id) {
    const row = this.getDnsRecord(organizationId, id);
    if (!row) return null;
    this.db.prepare('DELETE FROM dns_records WHERE id=?').run(id);
    return row;
  }

  upsertNode({ id = uuid(), nodeType, name, region = 'default', publicUrl = null, internalUrl = null, transport = 'tcp', status = 'healthy', capacity = 1000, activeConnections = 0, metadata = {} }) {
    const timestamp = nowIso();
    const existing = this.db.prepare('SELECT id FROM nodes WHERE node_type=? AND name=?').get(nodeType, name);
    const nodeId = existing?.id || id;
    if (existing) {
      this.db.prepare(`UPDATE nodes SET region=?,public_url=?,internal_url=?,transport=?,status=?,capacity=?,active_connections=?,metadata_json=?,last_seen_at=?,updated_at=? WHERE id=?`)
        .run(region, publicUrl, internalUrl, transport, status, capacity, activeConnections, JSON.stringify(metadata), timestamp, timestamp, nodeId);
    } else {
      this.db.prepare(`INSERT INTO nodes (id,node_type,name,region,public_url,internal_url,transport,status,capacity,active_connections,metadata_json,last_seen_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(nodeId, nodeType, name, region, publicUrl, internalUrl, transport, status, capacity, activeConnections, JSON.stringify(metadata), timestamp, timestamp, timestamp);
    }
    return this.getNode(nodeId);
  }
  getNode(id) { const row = this.db.prepare('SELECT * FROM nodes WHERE id=?').get(id); return row ? { ...row, metadata: parseJson(row.metadata_json, {}) } : null; }
  listNodes(nodeType = null) {
    const rows = nodeType ? this.db.prepare('SELECT * FROM nodes WHERE node_type=? ORDER BY region,name').all(nodeType) : this.db.prepare('SELECT * FROM nodes ORDER BY node_type,region,name').all();
    return rows.map((row) => ({ ...row, metadata: parseJson(row.metadata_json, {}) }));
  }
  markStaleNodesOffline(staleSeconds = 60) {
    const cutoff = new Date(Date.now() - staleSeconds * 1000).toISOString();
    this.db.prepare("UPDATE nodes SET status='offline',updated_at=? WHERE last_seen_at<? AND status!='offline'").run(nowIso(), cutoff);
  }
  selectRelay(region = null) {
    const query = region
      ? `SELECT * FROM nodes WHERE node_type='relay' AND status='healthy' AND region=? ORDER BY CAST(active_connections AS REAL)/MAX(capacity,1),active_connections LIMIT 1`
      : `SELECT * FROM nodes WHERE node_type='relay' AND status='healthy' ORDER BY CAST(active_connections AS REAL)/MAX(capacity,1),active_connections LIMIT 1`;
    return region ? this.db.prepare(query).get(region) ?? null : this.db.prepare(query).get() ?? null;
  }
  setAgentPresence(agentId, relayNodeId, relayEdgeUrl) {
    const timestamp = nowIso();
    this.db.prepare(`INSERT INTO agent_presence (agent_id,relay_node_id,relay_edge_url,connected_at,last_seen_at) VALUES (?,?,?,?,?) ON CONFLICT(agent_id) DO UPDATE SET relay_node_id=excluded.relay_node_id,relay_edge_url=excluded.relay_edge_url,last_seen_at=excluded.last_seen_at`)
      .run(agentId, relayNodeId, relayEdgeUrl, timestamp, timestamp);
  }
  getAgentPresence(agentId) { return this.db.prepare('SELECT * FROM agent_presence WHERE agent_id=?').get(agentId) ?? null; }
  consumeAgentAuthNonce(agentId, nonce, ttlSeconds = 120) {
    const now = nowIso();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return this.transaction(() => {
      this.db.prepare('DELETE FROM agent_auth_nonces WHERE expires_at<=?').run(now);
      try {
        this.db.prepare('INSERT INTO agent_auth_nonces (agent_id,nonce,expires_at) VALUES (?,?,?)').run(agentId, nonce, expiresAt);
        return true;
      } catch (error) {
        if (String(error.message).includes('UNIQUE') || String(error.message).includes('PRIMARY KEY')) return false;
        throw error;
      }
    });
  }
  clearAgentPresence(agentId, relayNodeId = null) {
    const current = this.getAgentPresence(agentId);
    if (!current || (relayNodeId && current.relay_node_id !== relayNodeId)) return false;
    this.db.prepare('DELETE FROM agent_presence WHERE agent_id=?').run(agentId);
    this.markAgentOffline(agentId);
    return true;
  }

  createPrivateNetwork({ organizationId, name, cidr, dnsDomain = null, mode = 'hub-spoke', hubAgentId = null }) {
    const range = cidrRange(cidr);
    if (!range) {
      const error = new Error('CIDR IPv4 inválido. Utilize prefixos entre /8 e /30.');
      error.statusCode = 422; error.code = 'CIDR_INVALID'; throw error;
    }
    if (hubAgentId) {
      const agent = this.getAgent(hubAgentId);
      if (!agent || agent.organization_id !== organizationId) {
        const error = new Error('Agent hub não pertence à organização.');
        error.statusCode = 422; error.code = 'HUB_AGENT_INVALID'; throw error;
      }
    }
    const id = uuid(); const timestamp = nowIso();
    this.db.prepare(`INSERT INTO private_networks (id,organization_id,name,cidr,dns_domain,mode,hub_agent_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, organizationId, name, cidr, dnsDomain, mode, hubAgentId, 'active', timestamp, timestamp);
    this.audit(organizationId, 'api_token', null, 'network.created', 'network', id, 'success', { name, cidr, mode });
    return this.getPrivateNetwork(organizationId, id);
  }
  getPrivateNetwork(organizationId, id) { return this.db.prepare('SELECT * FROM private_networks WHERE organization_id=? AND id=?').get(organizationId, id) ?? null; }
  listPrivateNetworks(organizationId) { return this.db.prepare('SELECT * FROM private_networks WHERE organization_id=? ORDER BY created_at DESC').all(organizationId); }
  deletePrivateNetwork(organizationId, id) {
    const row = this.getPrivateNetwork(organizationId, id); if (!row) return null;
    this.db.prepare('DELETE FROM private_networks WHERE id=?').run(id);
    this.audit(organizationId, 'api_token', null, 'network.deleted', 'network', id, 'success', {});
    return row;
  }
  allocateNetworkIp(networkId) {
    const network = this.db.prepare('SELECT * FROM private_networks WHERE id=?').get(networkId);
    if (!network) return null;
    const range = cidrRange(network.cidr);
    const used = new Set(this.db.prepare('SELECT virtual_ip FROM network_peers WHERE network_id=?').all(networkId).map((row) => row.virtual_ip));
    for (let value = range.network + 2; value < range.broadcast; value += 1) {
      const ip = intToIp(value); if (!used.has(ip)) return `${ip}/${range.prefix}`;
    }
    return null;
  }
  upsertNetworkPeer({ organizationId, networkId, agentId, publicKey = null, endpoint = null, allowedIps = [], persistentKeepalive = 25 }) {
    const network = this.getPrivateNetwork(organizationId, networkId);
    const agent = this.getAgent(agentId);
    if (!network || !agent || agent.organization_id !== organizationId) {
      const error = new Error('Rede ou agente inválido para esta organização.'); error.statusCode = 422; error.code = 'NETWORK_PEER_INVALID'; throw error;
    }
    const existing = this.db.prepare('SELECT * FROM network_peers WHERE network_id=? AND agent_id=?').get(networkId, agentId);
    const timestamp = nowIso();
    if (existing) {
      this.db.prepare('UPDATE network_peers SET public_key=COALESCE(?,public_key),endpoint=COALESCE(?,endpoint),allowed_ips_json=?,persistent_keepalive=?,updated_at=? WHERE id=?')
        .run(publicKey, endpoint, JSON.stringify(allowedIps), persistentKeepalive, timestamp, existing.id);
      return this.getNetworkPeer(organizationId, existing.id);
    }
    const virtualIp = this.allocateNetworkIp(networkId);
    if (!virtualIp) { const error = new Error('Faixa de IP da rede esgotada.'); error.statusCode = 409; error.code = 'NETWORK_IP_EXHAUSTED'; throw error; }
    const id = uuid();
    this.db.prepare(`INSERT INTO network_peers (id,organization_id,network_id,agent_id,virtual_ip,public_key,endpoint,allowed_ips_json,persistent_keepalive,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, organizationId, networkId, agentId, virtualIp, publicKey, endpoint, JSON.stringify(allowedIps), persistentKeepalive, 'pending', timestamp, timestamp);
    return this.getNetworkPeer(organizationId, id);
  }
  getNetworkPeer(organizationId, id) { const row = this.db.prepare('SELECT * FROM network_peers WHERE organization_id=? AND id=?').get(organizationId, id); return row ? { ...row, allowed_ips: parseJson(row.allowed_ips_json, []) } : null; }
  listNetworkPeers(organizationId, networkId) { return this.db.prepare('SELECT * FROM network_peers WHERE organization_id=? AND network_id=? ORDER BY created_at').all(organizationId, networkId).map((row) => ({ ...row, allowed_ips: parseJson(row.allowed_ips_json, []) })); }
  updateNetworkPeerKey(organizationId, networkId, agentId, publicKey) {
    this.db.prepare("UPDATE network_peers SET public_key=?,status='active',updated_at=? WHERE organization_id=? AND network_id=? AND agent_id=?")
      .run(publicKey, nowIso(), organizationId, networkId, agentId);
    return this.db.prepare('SELECT * FROM network_peers WHERE organization_id=? AND network_id=? AND agent_id=?').get(organizationId, networkId, agentId) ?? null;
  }

  upsertCertificate({ organizationId, primaryName, sans = [], issuer = 'letsencrypt', mode = 'caddy-managed', status = 'managed', expiresAt = null, metadata = {} }) {
    const timestamp = nowIso();
    const existing = this.db.prepare('SELECT id FROM certificates WHERE organization_id=? AND primary_name=?').get(organizationId, primaryName);
    const id = existing?.id || uuid();
    if (existing) this.db.prepare('UPDATE certificates SET san_json=?,issuer=?,mode=?,status=?,expires_at=?,metadata_json=?,updated_at=? WHERE id=?')
      .run(JSON.stringify(sans), issuer, mode, status, expiresAt, JSON.stringify(metadata), timestamp, id);
    else this.db.prepare('INSERT INTO certificates (id,organization_id,primary_name,san_json,issuer,mode,status,expires_at,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, organizationId, primaryName, JSON.stringify(sans), issuer, mode, status, expiresAt, JSON.stringify(metadata), timestamp, timestamp);
    return this.db.prepare('SELECT * FROM certificates WHERE id=?').get(id);
  }
  listCertificates(organizationId) { return this.db.prepare('SELECT * FROM certificates WHERE organization_id=? ORDER BY created_at DESC').all(organizationId); }

  overview(organizationId, activeConnections = 0) {
    this.markStaleNodesOffline();
    const agentsOnline = Number(this.db.prepare("SELECT COUNT(*) AS n FROM agents WHERE organization_id=? AND status='online'").get(organizationId).n);
    const tunnelsActive = Number(this.db.prepare("SELECT COUNT(*) AS n FROM tunnels WHERE organization_id=? AND status='active'").get(organizationId).n);
    const edgeNodesHealthy = Number(this.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE node_type='edge' AND status='healthy'").get().n) || 1;
    const relayNodesHealthy = Number(this.db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE node_type='relay' AND status='healthy'").get().n) || 1;
    const privateNetworks = Number(this.db.prepare("SELECT COUNT(*) AS n FROM private_networks WHERE organization_id=? AND status='active'").get(organizationId).n);
    return { agentsOnline, tunnelsActive, edgeNodesHealthy, relayNodesHealthy, privateNetworks, activeConnections, trafficTodayGb: 0, alerts: 0 };
  }

  listAudit(organizationId, limit = 100) {
    return this.db.prepare('SELECT * FROM audit_logs WHERE organization_id=? ORDER BY id DESC LIMIT ?').all(organizationId, limit);
  }

  backup(destination) {
    if (this.driver === 'memory') {
      throw new Error('Backup não está disponível quando TUNNARA_STORAGE_DRIVER=memory.');
    }
    const escaped = String(destination).replaceAll("'", "''");
    this.db.exec(`VACUUM INTO '${escaped}'`);
    return destination;
  }

  audit(organizationId, actorType, actorId, event, resourceType, resourceId, result, metadata) {
    this.db.prepare(`
      INSERT INTO audit_logs (organization_id,actor_type,actor_id,event,resource_type,resource_id,result,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(organizationId, actorType, actorId, event, resourceType, resourceId, result, JSON.stringify(metadata ?? {}), nowIso());
  }
}
