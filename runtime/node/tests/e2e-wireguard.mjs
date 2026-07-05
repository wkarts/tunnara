import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { WireGuardManager } from '../lib/wireguard.mjs';

test('WireGuard userspace gera chaves, configuração e controla a interface', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-wg-'));
  const bin = path.join(temp, 'bin');
  fs.mkdirSync(bin);
  const log = path.join(temp, 'wg-quick.log');
  fs.writeFileSync(path.join(bin, 'wg'), `#!/usr/bin/env bash\nif [[ "$1" == "genkey" ]]; then echo PRIVATE_KEY_TEST; elif [[ "$1" == "pubkey" ]]; then cat >/dev/null; echo PUBLIC_KEY_TEST; elif [[ "$1" == "show" ]]; then echo 'tnr-test public-key'; else exit 2; fi\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'wg-quick'), `#!/usr/bin/env bash\necho "$*" >> '${log}'\n`, { mode: 0o755 });
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  try {
    const manager = new WireGuardManager({ configDir: path.join(temp, 'configs') });
    const pair = await manager.generateKeyPair('network-one');
    assert.equal(pair.privateKey, 'PRIVATE_KEY_TEST');
    assert.equal(pair.publicKey, 'PUBLIC_KEY_TEST');
    const config = manager.writeConfig({
      network: { id: 'network-one', dns_domain: 'tunnara.internal' },
      peer: { id: 'peer-local', virtual_ip: '10.77.0.2/24' },
      peers: [{ id: 'peer-local', virtual_ip: '10.77.0.2/24', public_key: pair.publicKey }, {
        id: 'peer-remote', virtual_ip: '10.77.0.3/24', public_key: 'REMOTE_PUBLIC_KEY', endpoint: 'relay.example.com:51820', persistent_keepalive: 25,
      }],
      privateKey: pair.privateKey,
    });
    const text = fs.readFileSync(config, 'utf8');
    assert.match(text, /PrivateKey = PRIVATE_KEY_TEST/);
    assert.match(text, /PublicKey = REMOTE_PUBLIC_KEY/);
    assert.match(text, /Endpoint = relay\.example\.com:51820/);
    assert.match(text, /AllowedIPs = 10\.77\.0\.3\/32/);
    const up = await manager.up('network-one');
    const down = await manager.down('network-one');
    assert.equal(up.status, 'up');
    assert.equal(down.status, 'down');
    assert.match(fs.readFileSync(log, 'utf8'), /up .*tnr-network-one\.conf/);
    assert.match(fs.readFileSync(log, 'utf8'), /down .*tnr-network-one\.conf/);
    assert.equal((await manager.status()).available, true);
    console.log('E2E_OK WireGuard userspace, chaves, configuração e lifecycle validados.');
  } finally {
    process.env.PATH = oldPath;
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
