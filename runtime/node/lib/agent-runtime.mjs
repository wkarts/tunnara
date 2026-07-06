import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import dgram from 'node:dgram';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { URL } from 'node:url';
import { FramedConnection } from './framing.mjs';
import { agentAuthMessage, DEFAULT_MAX_BODY, isLoopbackHost, log, sleep, uuid, VERSION } from './utils.mjs';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function waitForPort(host, port, timeoutMs = 12000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) reject(new Error(`Timeout aguardando bridge QUIC em ${host}:${port}.`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

function openRelay(urlValue, insecureTls = false) {
  const url = new URL(urlValue);
  const port = Number(url.port || (url.protocol === 'tls:' ? 443 : 7300));
  const options = { host: url.hostname, port };
  return new Promise((resolve, reject) => {
    const socket = url.protocol === 'tls:'
      ? tls.connect({ ...options, rejectUnauthorized: !insecureTls, servername: url.hostname })
      : net.connect(options);
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

export class AgentRuntime {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.stopping = false;
    this.connection = null;
    this.streams = new Map();
    this.udpSessions = new Map();
    this.heartbeatTimer = null;
    this.wakeReconnect = null;
    this.relayIndex = 0;
    this.quicBridgeProcess = null;
    this.quicBridgeKey = null;
  }

  async run() {
    let attempt = 0;
    while (!this.stopping) {
      try {
        await this.#runConnection();
        attempt = 0;
      } catch (error) {
        if (this.stopping) break;
        attempt += 1;
        const delay = Math.min(30000, 500 * (2 ** Math.min(attempt, 6))) + Math.floor(Math.random() * 500);
        log('agent', 'warn', 'Conexão com relay interrompida; reconectando.', { error: error.message, delay });
        await Promise.race([sleep(delay), new Promise((resolve) => { this.wakeReconnect = resolve; })]);
        this.wakeReconnect = null;
      }
    }
  }

  stop() {
    this.stopping = true;
    clearInterval(this.heartbeatTimer);
    this.wakeReconnect?.();
    this.wakeReconnect = null;
    this.connection?.destroy();
    if (this.quicBridgeProcess && !this.quicBridgeProcess.killed) this.quicBridgeProcess.kill('SIGTERM');
    this.quicBridgeProcess = null;
    for (const socket of this.streams.values()) socket.destroy();
    this.streams.clear();
    for (const session of this.udpSessions.values()) session.socket.close();
    this.udpSessions.clear();
  }

  async #prepareRelayUrl(relayUrl) {
    const parsed = new URL(relayUrl);
    if (parsed.protocol !== 'quic:') return relayUrl;
    const remotePort = Number(parsed.port || 7443);
    const localPort = Number(this.config.quicLocalPort || this.options.quicLocalPort || process.env.TUNNARA_QUIC_LOCAL_PORT || 17300);
    const bridgeBinary = String(this.config.quicBridgeBinary || this.options.quicBridgeBinary || process.env.TUNNARA_QUIC_BRIDGE_BINARY || 'tunnara-quic-bridge');
    const ca = String(this.config.quicCa || this.options.quicCa || process.env.TUNNARA_QUIC_CA || '');
    const key = `${parsed.hostname}:${remotePort}|${localPort}|${ca}|${bridgeBinary}`;
    if (!this.quicBridgeProcess || this.quicBridgeProcess.exitCode !== null || this.quicBridgeKey !== key) {
      if (this.quicBridgeProcess && !this.quicBridgeProcess.killed) this.quicBridgeProcess.kill('SIGTERM');
      const args = ['client', '--listen', `127.0.0.1:${localPort}`, '--remote', `${parsed.hostname}:${remotePort}`, '--server-name', parsed.hostname];
      if (ca) args.push('--ca', ca);
      this.quicBridgeProcess = childProcess.spawn(bridgeBinary, args, { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
      this.quicBridgeKey = key;
      this.quicBridgeProcess.once('error', (error) => log('agent', 'error', 'Não foi possível iniciar o bridge QUIC.', { error: error.message, bridgeBinary }));
      this.quicBridgeProcess.once('exit', (code, signal) => log('agent', code === 0 ? 'info' : 'warn', 'Bridge QUIC encerrado.', { code, signal }));
      await waitForPort('127.0.0.1', localPort);
    }
    return `tcp://127.0.0.1:${localPort}`;
  }

  async #runConnection() {
    const relayUrls = Array.isArray(this.config.relayUrls) && this.config.relayUrls.length ? this.config.relayUrls : [this.config.relayUrl];
    const relayUrl = relayUrls[this.relayIndex % relayUrls.length];
    this.relayIndex = (this.relayIndex + 1) % relayUrls.length;
    const effectiveRelayUrl = await this.#prepareRelayUrl(relayUrl);
    const socket = await openRelay(effectiveRelayUrl, this.options.insecureTls === true);
    const connection = new FramedConnection(socket);
    this.connection = connection;
    if (!this.config.privateKey) throw new Error('Chave privada do agente ausente. Execute o login novamente.');
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(24).toString('base64url');
    const proof = crypto.sign(null, agentAuthMessage({
      agentId: this.config.agentId, timestamp, nonce, sessionToken: this.config.sessionToken,
    }), this.config.privateKey).toString('base64');
    connection.send({
      type: 'agent_hello', agentId: this.config.agentId, sessionToken: this.config.sessionToken,
      version: this.config.version || VERSION, timestamp, nonce, proof,
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout aguardando autenticação do relay.')), 10000);
      const first = (frame) => {
        clearTimeout(timer);
        if (frame.type === 'agent_hello_ok') resolve();
        else reject(new Error(frame.message || 'Relay recusou a autenticação.'));
      };
      connection.once('frame', first);
      connection.once('error', reject);
      connection.once('close', () => reject(new Error('Relay encerrou a conexão durante o handshake.')));
    });
    this.config.relayUrl = relayUrl;
    log('agent', 'info', 'Agente conectado ao relay.', { agentId: this.config.agentId, relayUrl, effectiveRelayUrl, candidates: relayUrls.length });
    this.heartbeatTimer = setInterval(() => connection.send({ type: 'heartbeat', at: new Date().toISOString() }), 15000);
    connection.on('frame', (frame) => void this.#onFrame(connection, frame));
    await new Promise((resolve, reject) => {
      connection.once('close', resolve);
      connection.once('error', reject);
    });
    clearInterval(this.heartbeatTimer);
    this.connection = null;
  }

  async #onFrame(connection, frame) {
    if (frame.type === 'proxy_request') return this.#proxyHttp(connection, frame);
    if (frame.type === 'health_probe') return this.#healthProbe(connection, frame);
    if (frame.type === 'stream_open') return this.#streamOpen(connection, frame);
    if (frame.type === 'stream_data') {
      const socket = this.streams.get(frame.streamId);
      if (socket) socket.write(Buffer.from(frame.dataBase64 || '', 'base64'));
      return;
    }
    if (frame.type === 'stream_close') {
      const socket = this.streams.get(frame.streamId);
      if (socket) socket.end();
      this.streams.delete(frame.streamId);
      return;
    }
    if (frame.type === 'udp_datagram') return this.#udpDatagram(connection, frame);
    if (frame.type === 'udp_close') {
      const session = this.udpSessions.get(frame.sessionId);
      if (session) session.socket.close();
      this.udpSessions.delete(frame.sessionId);
    }
  }

  async #healthProbe(connection, frame) {
    const startedAt = process.hrtime.bigint();
    const reply = (healthy, error = null, status = null) => connection.send({
      type: 'health_probe_response', probeId: frame.probeId, targetId: frame.targetId,
      healthy, error, status, latencyMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
    });
    try {
      if (!isLoopbackHost(frame.targetHost) && !this.options.allowRemoteTargets) throw new Error('Destino remoto bloqueado pelo agente.');
      const check = frame.healthCheck || {};
      const timeoutMs = Math.max(250, Number(frame.timeoutMs || check.timeoutSeconds * 1000 || 5000));
      const type = String(check.type || 'tcp').toLowerCase();
      if (type === 'http' || type === 'https') {
        const client = type === 'https' ? https : http;
        const status = await new Promise((resolve, reject) => {
          const req = client.request({
            host: frame.targetHost, port: Number(frame.targetPort), method: String(check.method || 'GET'),
            path: String(check.path || '/healthz'), timeout: timeoutMs,
            rejectUnauthorized: check.insecureTls !== true,
            headers: { 'user-agent': `Tunnara-Health/${VERSION}`, ...(check.headers || {}) },
          }, (res) => { res.resume(); res.once('end', () => resolve(res.statusCode || 0)); });
          req.once('timeout', () => req.destroy(new Error('health_check_timeout')));
          req.once('error', reject); req.end();
        });
        const expected = Array.isArray(check.expectedStatuses) && check.expectedStatuses.length ? check.expectedStatuses.map(Number) : [200, 204];
        return reply(expected.includes(status), expected.includes(status) ? null : `unexpected_status_${status}`, status);
      }
      await new Promise((resolve, reject) => {
        const socket = net.connect({ host: frame.targetHost, port: Number(frame.targetPort) });
        const timer = setTimeout(() => socket.destroy(new Error('health_check_timeout')), timeoutMs);
        socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(); });
        socket.once('error', (error) => { clearTimeout(timer); reject(error); });
      });
      return reply(true);
    } catch (error) {
      return reply(false, error.message);
    }
  }

  async #proxyHttp(connection, frame) {
    const requestId = frame.requestId || uuid();
    try {
      if (!isLoopbackHost(frame.targetHost) && !this.options.allowRemoteTargets) throw new Error('Destino remoto bloqueado pelo agente.');
      const body = Buffer.from(frame.bodyBase64 || '', 'base64');
      if (body.length > (this.options.maxBodyBytes || DEFAULT_MAX_BODY)) throw new Error('Corpo da requisição excede o limite do agente.');
      const headers = {};
      for (const [key, value] of Object.entries(frame.headers || {})) {
        if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'host' && value !== undefined) headers[key] = value;
      }
      headers.host = `${frame.targetHost}:${frame.targetPort}`;
      const response = await new Promise((resolve, reject) => {
        const req = http.request({
          host: frame.targetHost,
          port: frame.targetPort,
          method: frame.method || 'GET',
          path: frame.path || '/',
          headers,
          timeout: this.options.upstreamTimeoutMs || 30000,
        }, (res) => {
          const chunks = [];
          let total = 0;
          res.on('data', (chunk) => {
            total += chunk.length;
            if (total > (this.options.maxBodyBytes || DEFAULT_MAX_BODY)) {
              res.destroy(new Error('Resposta do upstream excede o limite.'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => resolve({ status: res.statusCode || 502, headers: res.headers, body: Buffer.concat(chunks) }));
          res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('Timeout no serviço local.')));
        req.on('error', reject);
        if (body.length) req.write(body);
        req.end();
      });
      const responseHeaders = {};
      for (const [key, value] of Object.entries(response.headers || {})) {
        if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'content-length' && value !== undefined) responseHeaders[key] = value;
      }
      connection.send({
        type: 'proxy_response', requestId, status: response.status,
        headers: responseHeaders, bodyBase64: response.body.toString('base64'),
      });
    } catch (error) {
      log('agent', 'warn', 'Falha no upstream local.', { requestId, error: error.message });
      connection.send({ type: 'proxy_error', requestId, status: 502, message: error.message });
    }
  }

  #streamOpen(connection, frame) {
    if (!isLoopbackHost(frame.targetHost) && !this.options.allowRemoteTargets) {
      connection.send({ type: 'stream_close', streamId: frame.streamId, reason: 'target_not_allowed' });
      return;
    }
    const socket = net.connect({ host: frame.targetHost, port: Number(frame.targetPort) });
    this.streams.set(frame.streamId, socket);
    socket.once('connect', () => {
      connection.send({ type: 'stream_opened', streamId: frame.streamId });
      const initial = Buffer.from(frame.initialDataBase64 || '', 'base64');
      if (initial.length) socket.write(initial);
    });
    socket.on('data', (chunk) => connection.send({ type: 'stream_data', streamId: frame.streamId, dataBase64: chunk.toString('base64') }));
    socket.on('end', () => connection.send({ type: 'stream_close', streamId: frame.streamId, reason: 'upstream_end' }));
    socket.on('close', () => this.streams.delete(frame.streamId));
    socket.on('error', (error) => {
      connection.send({ type: 'stream_close', streamId: frame.streamId, reason: error.message });
      this.streams.delete(frame.streamId);
    });
  }

  #udpDatagram(connection, frame) {
    if (!isLoopbackHost(frame.targetHost) && !this.options.allowRemoteTargets) {
      connection.send({ type: 'udp_close', sessionId: frame.sessionId, reason: 'target_not_allowed' });
      return;
    }
    let session = this.udpSessions.get(frame.sessionId);
    if (!session) {
      const socket = dgram.createSocket(String(frame.targetHost).includes(':') ? 'udp6' : 'udp4');
      session = { socket, targetHost: frame.targetHost, targetPort: Number(frame.targetPort), lastSeenAt: Date.now() };
      this.udpSessions.set(frame.sessionId, session);
      socket.on('message', (message) => {
        session.lastSeenAt = Date.now();
        connection.send({ type: 'udp_response', sessionId: frame.sessionId, dataBase64: message.toString('base64') });
      });
      socket.on('error', (error) => {
        connection.send({ type: 'udp_close', sessionId: frame.sessionId, reason: error.message });
        socket.close();
        this.udpSessions.delete(frame.sessionId);
      });
      socket.on('close', () => this.udpSessions.delete(frame.sessionId));
      socket.bind(0);
    }
    session.lastSeenAt = Date.now();
    const data = Buffer.from(frame.dataBase64 || '', 'base64');
    session.socket.send(data, session.targetPort, session.targetHost);
  }
}
