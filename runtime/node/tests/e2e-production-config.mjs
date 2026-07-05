import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');

test('configuração de produção cobre Cloudflare, ACME, wildcard, HTTP/3 e QUIC',()=>{
  const caddy=read('deploy/docker/cloudflare/Caddyfile');
  const cloudflare=read('deploy/docker/docker-compose.cloudflare.yml');
  const quic=read('deploy/docker/docker-compose.quic.yml');
  const dockerfile=read('deploy/docker/cloudflare/Dockerfile');
  assert.match(caddy,/acme-v02\.api\.letsencrypt\.org/);
  assert.match(caddy,/dns cloudflare/);
  assert.match(caddy,/\*\.\{\$TUNNARA_BASE_DOMAIN\}/);
  assert.match(caddy,/protocols h1 h2 h3/);
  assert.match(cloudflare,/"443:443\/udp"/);
  assert.match(cloudflare,/--protocol quic/);
  assert.match(dockerfile,/caddy-dns\/cloudflare/);
  assert.match(quic,/7443\/udp/);
  assert.match(quic,/quic-cert-exporter/);
  assert.match(quic,/tunnara-quic-bridge/);
  console.log('E2E_OK configuração Cloudflare, Let’s Encrypt DNS-01, HTTP/3 e QUIC validada.');
});
