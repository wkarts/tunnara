import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { atomicWriteJson, ensureDir, readJsonFile } from './utils.mjs';

const execFile = promisify(childProcess.execFile);

function commandExists(command) {
  const result = childProcess.spawnSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32' ? [command] : ['-c', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

export class WireGuardManager {
  constructor({ configDir, commandTimeoutMs = 15000 } = {}) {
    this.configDir = path.resolve(configDir || path.join(os.homedir(), '.tunnara', 'wireguard'));
    this.commandTimeoutMs = commandTimeoutMs;
    ensureDir(this.configDir);
  }

  capabilities() {
    return {
      platform: process.platform,
      wg: commandExists('wg'),
      wgQuick: commandExists('wg-quick'),
      wireguardGo: commandExists('wireguard-go'),
      wireguardExe: process.platform === 'win32' && commandExists('wireguard.exe'),
    };
  }

  async generateKeyPair(networkId) {
    const metadataFile = path.join(this.configDir, `${networkId}.keys.json`);
    const existing = readJsonFile(metadataFile);
    if (existing?.privateKey && existing?.publicKey) return existing;
    if (!commandExists('wg')) throw new Error('O comando wg não está instalado. Instale wireguard-tools ou WireGuard oficial.');
    const { stdout: privateStdout } = await execFile('wg', ['genkey'], { timeout: this.commandTimeoutMs });
    const privateKey = privateStdout.trim();
    const publicResult = childProcess.spawnSync('wg', ['pubkey'], {
      input: `${privateKey}\n`, encoding: 'utf8', timeout: this.commandTimeoutMs,
    });
    if (publicResult.status !== 0) throw new Error(publicResult.stderr || 'Falha ao derivar chave pública WireGuard.');
    const pair = { privateKey, publicKey: String(publicResult.stdout).trim(), createdAt: new Date().toISOString() };
    atomicWriteJson(metadataFile, pair, 0o600);
    return pair;
  }

  configPath(networkId) {
    return path.join(this.configDir, `tnr-${String(networkId).slice(0, 12)}.conf`);
  }

  writeConfig({ network, peer, peers, privateKey, dns = null }) {
    const lines = ['[Interface]', `PrivateKey = ${privateKey}`, `Address = ${peer.virtual_ip}`];
    if (dns || network.dns_domain) lines.push(`DNS = ${dns || network.dns_domain}`);
    for (const remote of peers.filter((item) => item.id !== peer.id && item.public_key)) {
      lines.push('', '[Peer]', `PublicKey = ${remote.public_key}`);
      const allowed = Array.isArray(remote.allowed_ips) && remote.allowed_ips.length
        ? remote.allowed_ips
        : [String(remote.virtual_ip).split('/')[0] + '/32'];
      lines.push(`AllowedIPs = ${allowed.join(', ')}`);
      if (remote.endpoint) lines.push(`Endpoint = ${remote.endpoint}`);
      if (remote.persistent_keepalive) lines.push(`PersistentKeepalive = ${remote.persistent_keepalive}`);
    }
    const file = this.configPath(network.id);
    fs.writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch {}
    return file;
  }

  async up(networkId) {
    const file = this.configPath(networkId);
    if (!fs.existsSync(file)) throw new Error(`Configuração WireGuard inexistente: ${file}`);
    if (process.platform === 'win32') {
      const executable = process.env.TUNNARA_WIREGUARD_EXE || 'wireguard.exe';
      await execFile(executable, ['/installtunnelservice', file], { timeout: this.commandTimeoutMs });
      return { status: 'up', method: 'wireguard-service', config: file };
    }
    if (commandExists('wg-quick')) {
      await execFile('wg-quick', ['up', file], { timeout: this.commandTimeoutMs });
      return { status: 'up', method: 'wg-quick', config: file };
    }
    throw new Error('wg-quick não está instalado. Instale wireguard-tools; wireguard-go pode ser usado pelo sistema como backend userspace.');
  }

  async down(networkId) {
    const file = this.configPath(networkId);
    if (process.platform === 'win32') {
      const executable = process.env.TUNNARA_WIREGUARD_EXE || 'wireguard.exe';
      const name = path.basename(file, '.conf');
      await execFile(executable, ['/uninstalltunnelservice', name], { timeout: this.commandTimeoutMs });
      return { status: 'down', method: 'wireguard-service', config: file };
    }
    if (commandExists('wg-quick')) {
      await execFile('wg-quick', ['down', file], { timeout: this.commandTimeoutMs });
      return { status: 'down', method: 'wg-quick', config: file };
    }
    throw new Error('wg-quick não está instalado.');
  }

  async status() {
    if (!commandExists('wg')) return { available: false, interfaces: '' };
    const { stdout } = await execFile('wg', ['show'], { timeout: this.commandTimeoutMs });
    return { available: true, interfaces: stdout };
  }
}
