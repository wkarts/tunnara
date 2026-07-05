import { log, uuid } from './utils.mjs';

export class ClusterControlClient {
  constructor({ baseUrl, clusterToken, timeoutMs = 10000 }) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.clusterToken = String(clusterToken || '');
    this.timeoutMs = timeoutMs;
    if (!this.baseUrl || !this.clusterToken) throw new Error('Control URL interna e cluster token são obrigatórios.');
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        Accept: 'application/json',
        'X-Tunnara-Cluster-Token': this.clusterToken,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
    if (!response.ok) {
      const error = new Error(payload?.message || `Control interno respondeu HTTP ${response.status}.`);
      error.statusCode = response.status; error.code = payload?.error || 'CLUSTER_CONTROL_ERROR';
      throw error;
    }
    return payload;
  }

  registerNode(body) { return this.request('/internal/v1/nodes/register', { method: 'POST', body }); }
  heartbeatNode(body) { return this.request('/internal/v1/nodes/heartbeat', { method: 'POST', body }); }
  authenticateAgent(hello) { return this.request('/internal/v1/agents/authenticate', { method: 'POST', body: hello }); }
  agentPresence(body) { return this.request('/internal/v1/agents/presence', { method: 'POST', body }); }
  agentHeartbeat(body) { return this.request('/internal/v1/agents/heartbeat', { method: 'POST', body }); }
  resolveHostname(hostname) { return this.request(`/internal/v1/routes/hostname/${encodeURIComponent(hostname)}`); }
  getTunnel(id) { return this.request(`/internal/v1/tunnels/${encodeURIComponent(id)}`); }
  listTunnels(protocol) { return this.request(`/internal/v1/tunnels?protocol=${encodeURIComponent(protocol || '')}`); }
}

export class NodeRegistrar {
  constructor({ client, nodeType, name, region = 'default', publicUrl = null, internalUrl = null, transport = 'tcp', capacity = 1000, metadata = {}, activeConnections = () => 0, intervalMs = 15000 }) {
    this.client = client; this.nodeType = nodeType; this.name = name || `${nodeType}-${uuid().slice(0, 8)}`;
    this.region = region; this.publicUrl = publicUrl; this.internalUrl = internalUrl; this.transport = transport;
    this.capacity = capacity; this.metadata = metadata; this.activeConnections = activeConnections; this.intervalMs = intervalMs;
    this.nodeId = null; this.timer = null; this.stopped = false;
  }

  body(status = 'healthy') {
    return { id: this.nodeId || undefined, nodeType: this.nodeType, name: this.name, region: this.region,
      publicUrl: this.publicUrl, internalUrl: this.internalUrl, transport: this.transport, status,
      capacity: this.capacity, activeConnections: Number(this.activeConnections() || 0), metadata: this.metadata };
  }

  async start() {
    const registered = await this.client.registerNode(this.body());
    this.nodeId = registered.id;
    this.timer = setInterval(() => void this.beat(), this.intervalMs); this.timer.unref?.();
    log('cluster', 'info', 'Nó registrado no Control Plane.', { nodeId: this.nodeId, nodeType: this.nodeType, name: this.name, region: this.region });
    return registered;
  }

  async beat() {
    if (this.stopped) return;
    try { await this.client.heartbeatNode(this.body()); }
    catch (error) { log('cluster', 'warn', 'Heartbeat do nó falhou.', { nodeId: this.nodeId, error: error.message }); }
  }

  async stop() {
    this.stopped = true; clearInterval(this.timer);
    try { await this.client.heartbeatNode(this.body('offline')); } catch {}
  }
}

export function relayEndpoint(value, fallbackHost = '127.0.0.1', fallbackPort = 7301) {
  if (!value) return { protocol: 'tcp:', host: fallbackHost, port: fallbackPort };
  try {
    const url = new URL(value);
    return { protocol: url.protocol, host: url.hostname, port: Number(url.port || (url.protocol === 'tls:' ? 443 : fallbackPort)), servername: url.hostname };
  } catch {
    const [host, port] = String(value).split(':');
    return { protocol: 'tcp:', host: host || fallbackHost, port: Number(port || fallbackPort) };
  }
}
