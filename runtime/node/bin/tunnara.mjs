#!/usr/bin/env node
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { AgentRuntime } from '../lib/agent-runtime.mjs';
import { AgentLocalApi } from '../lib/agent-api.mjs';
import { WireGuardManager } from '../lib/wireguard.mjs';
import { atomicWriteJson, log, parseCli, randomToken, readJsonFile, VERSION } from '../lib/utils.mjs';

const { positional, options } = parseCli(process.argv.slice(2));
const command = positional[0] || 'help';
const configDir = path.resolve(String(options['config-dir'] || process.env.TUNNARA_CONFIG_DIR || path.join(os.homedir(), '.tunnara')));
const configFile = path.join(configDir, 'config.json');

function help() {
  console.log(`Tunnara Agent ${VERSION}

` +
`Uso:
` +
`  tunnara login --token tnr_prov_xxx --name meu-servidor --control-url https://control.exemplo.com
` +
`  tunnara http 8080 [--domain app.exemplo.com] [--auto-dns]
` +
`  tunnara tcp 22 [--remote-port 22022]
` +
`  tunnara udp 51820 [--remote-port 25000]
` +
`  tunnara serve [--local-api-port 7390]
` +
`  tunnara status
` +
`  tunnara tunnel list | delete ID
` +
`  tunnara network list | join ID | leave ID
` +
`  tunnara logout
` +
`  tunnara admin provision --admin-token tnr_admin_xxx
` +
`  tunnara admin token create --name CI --scopes tunnels:read,tunnels:write
` +
`  tunnara admin cloudflare configure --zone example.com --api-token TOKEN --edge-address IP
` +
`  tunnara admin cloudflare test | bootstrap-dns

` +
`Opções:
` +
`  --config-dir CAMINHO       Diretório da identidade do agente
` +
`  --insecure-tls             Aceita certificado TLS não confiável no relay
` +
`  --quic-ca CAMINHO          CA que valida o servidor QUIC
` +
`  --quic-bridge CAMINHO      Binário tunnara-quic-bridge
` +
`  --quic-local-port PORTA    Listener local do bridge (padrão: 17300)
` +
`  --allow-remote-targets     Permite encaminhar para destinos fora do localhost
` +
`  --timeout MS               Timeout da Control API (padrão: 15000)
` +
`  --json                     Saída JSON quando aplicável
`);
}

function requireConfig() {
  const config = readJsonFile(configFile);
  if (!config?.agentId || !config?.sessionToken || !config?.controlUrl || !config?.relayUrl) {
    throw new Error(`Agente não autenticado. Execute "tunnara login". Configuração esperada em ${configFile}.`);
  }
  return config;
}

async function requestJson(url, { method = 'GET', token = '', headers = {}, body } = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeout || process.env.TUNNARA_HTTP_TIMEOUT_MS || 15000));
  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  return payload;
}

function print(value) {
  if (options.json || typeof value !== 'string') console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

async function login() {
  const provisioningToken = String(options.token || '');
  if (!provisioningToken) throw new Error('--token é obrigatório.');
  const controlUrl = String(options['control-url'] || process.env.TUNNARA_CONTROL_URL || 'http://127.0.0.1:7100').replace(/\/$/, '');
  const name = String(options.name || os.hostname());
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const registered = await requestJson(`${controlUrl}/api/v1/agents/register`, {
    method: 'POST',
    headers: { 'X-Tunnara-Provisioning-Token': provisioningToken },
    body: {
      name,
      platform: process.platform,
      architecture: process.arch,
      version: VERSION,
      publicKey,
    },
  });
  const config = {
    version: VERSION,
    agentId: registered.id,
    organizationId: registered.organizationId,
    sessionToken: registered.sessionToken,
    controlUrl: String(options['control-url'] || registered.controlUrl || controlUrl).replace(/\/$/, ''),
    relayUrl: String(options['relay-url'] || registered.relayUrl || process.env.TUNNARA_RELAY_URL || 'tcp://127.0.0.1:7300'),
    relayUrls: options['relay-url'] ? [String(options['relay-url'])] : (Array.isArray(registered.relayUrls) && registered.relayUrls.length ? registered.relayUrls : [String(registered.relayUrl || process.env.TUNNARA_RELAY_URL || 'tcp://127.0.0.1:7300')]),
    name,
    publicKey,
    privateKey,
    localApiToken: randomToken('tnr_local'),
    localApiPort: Number(options['local-api-port'] || 7390),
    quicCa: options['quic-ca'] ? String(options['quic-ca']) : (process.env.TUNNARA_QUIC_CA || undefined),
    quicBridgeBinary: options['quic-bridge'] ? String(options['quic-bridge']) : (process.env.TUNNARA_QUIC_BRIDGE_BINARY || undefined),
    quicLocalPort: Number(options['quic-local-port'] || process.env.TUNNARA_QUIC_LOCAL_PORT || 17300),
    createdAt: new Date().toISOString(),
  };
  atomicWriteJson(configFile, config, 0o600);
  print({ status: 'authenticated', agentId: config.agentId, controlUrl: config.controlUrl, relayUrl: config.relayUrl, relayUrls: config.relayUrls, configFile });
}

async function createTunnel(protocol) {
  const config = requireConfig();
  const port = Number(positional[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Informe uma porta local válida. Exemplo: tunnara ${protocol} 8080`);
  const body = {
    protocol,
    name: String(options.name || `${protocol.toUpperCase()} ${port}`),
    hostname: options.domain ? String(options.domain) : undefined,
    targetHost: String(options.host || '127.0.0.1'),
    targetPort: port,
    publicPort: options['remote-port'] ? Number(options['remote-port']) : undefined,
    autoDns: options['auto-dns'] === true,
    transport: String(options.transport || 'auto'),
  };
  const tunnel = await requestJson(`${config.controlUrl}/api/v1/tunnels`, {
    method: 'POST', token: config.sessionToken, body,
  });
  const scheme = ['http', 'https'].includes(protocol) ? `${protocol}://` : `${protocol}://`;
  console.log(`Túnel online
Endpoint:   ${tunnel.endpoint || `${scheme}${tunnel.hostname}:${tunnel.publicPort}`}
Upstream:   ${protocol}://${tunnel.target}
Tunnel ID:  ${tunnel.id}`);
  await runAgent(config);
}

async function runAgent(config = requireConfig()) {
  const runtime = new AgentRuntime(config, {
    insecureTls: options['insecure-tls'] === true,
    allowRemoteTargets: options['allow-remote-targets'] === true,
    quicCa: options['quic-ca'] ? String(options['quic-ca']) : undefined,
    quicBridgeBinary: options['quic-bridge'] ? String(options['quic-bridge']) : undefined,
    quicLocalPort: Number(options['quic-local-port'] || 0) || undefined,
  });
  const localApi = options['no-local-api'] === true ? null : new AgentLocalApi({
    config,
    configDir,
    host: String(options['local-api-host'] || '127.0.0.1'),
    port: Number(options['local-api-port'] || config.localApiPort || 7390),
  });
  let stopRequested = false;
  const stop = () => {
    if (stopRequested) return;
    stopRequested = true;
    runtime.stop();
    void localApi?.stop();
    setTimeout(() => process.exit(0), 250).unref();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    if (localApi) await localApi.start();
    await runtime.run();
  } finally {
    await localApi?.stop().catch(() => {});
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

async function status() {
  const config = requireConfig();
  const [overview, tunnels] = await Promise.all([
    requestJson(`${config.controlUrl}/api/v1/overview`, { token: config.sessionToken }),
    requestJson(`${config.controlUrl}/api/v1/tunnels`, { token: config.sessionToken }),
  ]);
  print({ agentId: config.agentId, name: config.name, controlUrl: config.controlUrl, relayUrl: config.relayUrl, relayUrls: config.relayUrls || [config.relayUrl], overview, tunnels: tunnels.data });
}

async function tunnelCommand() {
  const config = requireConfig();
  const action = positional[1] || 'list';
  if (action === 'list') {
    const result = await requestJson(`${config.controlUrl}/api/v1/tunnels`, { token: config.sessionToken });
    return print(result.data);
  }
  if (action === 'delete' || action === 'stop') {
    const id = positional[2];
    if (!id) throw new Error('Informe o ID do túnel.');
    await requestJson(`${config.controlUrl}/api/v1/tunnels/${encodeURIComponent(id)}`, { method: 'DELETE', token: config.sessionToken });
    return print({ status: 'deleted', id });
  }
  throw new Error(`Ação de túnel desconhecida: ${action}`);
}

async function networkCommand() {
  const config = requireConfig();
  const action = positional[1] || 'list';
  if (action === 'list') {
    const result = await requestJson(`${config.controlUrl}/api/v1/networks`, { token: config.sessionToken });
    return print(result.data);
  }
  const networkId = positional[2];
  if (!networkId) throw new Error('Informe o ID da rede.');
  const manager = new WireGuardManager({ configDir: path.join(configDir, 'wireguard') });
  if (action === 'join') {
    const keys = await manager.generateKeyPair(networkId);
    const result = await requestJson(`${config.controlUrl}/api/v1/networks/${networkId}/peers`, {
      method: 'POST', token: config.sessionToken, body: { publicKey: keys.publicKey },
    });
    const file = manager.writeConfig({ network: result.network, peer: result.peer, peers: result.peers, privateKey: keys.privateKey });
    const activation = options.configure === true ? { status: 'configured', config: file } : await manager.up(networkId);
    return print({ ...result, activation });
  }
  if (action === 'leave') return print(await manager.down(networkId));
  throw new Error('Use: tunnara network list | join ID | leave ID.');
}

async function adminCommand() {
  const action = positional[1];
  const adminToken = String(options['admin-token'] || process.env.TUNNARA_ADMIN_TOKEN || '');
  if (!adminToken) throw new Error('--admin-token é obrigatório.');
  const controlUrl = String(options['control-url'] || process.env.TUNNARA_CONTROL_URL || 'http://127.0.0.1:7100').replace(/\/$/, '');
  if (action === 'provision') {
    const result = await requestJson(`${controlUrl}/api/v1/provisioning-tokens`, {
      method: 'POST', token: adminToken,
      body: { name: String(options.name || 'Novo agente'), ttlSeconds: Number(options.ttl || 900) },
    });
    return print(result);
  }
  if (action === 'token') {
    const tokenAction = positional[2] || 'list';
    if (tokenAction === 'list') {
      const result = await requestJson(`${controlUrl}/api/v1/api-tokens`, { token: adminToken });
      return print(result.data);
    }
    if (tokenAction === 'create') {
      const scopes = String(options.scopes || '*').split(',').map((value) => value.trim()).filter(Boolean);
      const result = await requestJson(`${controlUrl}/api/v1/api-tokens`, {
        method: 'POST', token: adminToken, body: { name: String(options.name || 'Novo token'), scopes },
      });
      return print(result);
    }
    if (tokenAction === 'revoke') {
      const id = positional[3];
      if (!id) throw new Error('Informe o ID do token.');
      await requestJson(`${controlUrl}/api/v1/api-tokens/${encodeURIComponent(id)}`, { method: 'DELETE', token: adminToken });
      return print({ status: 'revoked', id });
    }
  }
  if (action === 'cloudflare') {
    const cloudAction = positional[2] || 'test';
    if (cloudAction === 'configure') {
      const body = {
        zoneName: String(options.zone || ''), apiToken: String(options['api-token'] || ''),
        zoneId: options['zone-id'] || undefined, edgeHostname: options['edge-hostname'] || undefined,
        edgeAddress: options['edge-address'] || undefined, proxied: options.proxied === true,
        dnsMode: String(options['dns-mode'] || 'wildcard'), acmeEmail: options['acme-email'] || undefined,
        acmeStaging: options.staging === true,
      };
      return print(await requestJson(`${controlUrl}/api/v1/integrations/cloudflare`, { method: 'PUT', token: adminToken, body }));
    }
    if (cloudAction === 'test') return print(await requestJson(`${controlUrl}/api/v1/integrations/cloudflare/test`, { method: 'POST', token: adminToken }));
    if (cloudAction === 'bootstrap-dns') return print(await requestJson(`${controlUrl}/api/v1/integrations/cloudflare/bootstrap-dns`, { method: 'POST', token: adminToken }));
  }
  throw new Error('Use: tunnara admin provision, token <create|list|revoke> ou cloudflare <configure|test|bootstrap-dns>.');
}

async function main() {
  if (command === 'help' || options.help || options.version) {
    if (options.version) console.log(VERSION); else help();
    return;
  }
  if (command === 'login') return login();
  if (['http', 'https', 'tcp', 'udp'].includes(command)) return createTunnel(command);
  if (command === 'serve') return runAgent();
  if (command === 'status') return status();
  if (command === 'tunnel') return tunnelCommand();
  if (command === 'network') return networkCommand();
  if (command === 'admin') return adminCommand();
  if (command === 'logout') {
    const fs = await import('node:fs');
    try { fs.unlinkSync(configFile); } catch {}
    return print({ status: 'logged_out', configFile });
  }
  help(); process.exitCode = 2;
}

main().catch((error) => {
  log('cli', 'error', error.message);
  process.exit(1);
});
