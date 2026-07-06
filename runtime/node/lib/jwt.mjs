import crypto from 'node:crypto';

const caches = new Map();
const base64url = (value) => Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '='), 'base64');
const parseJson = (buffer) => JSON.parse(buffer.toString('utf8'));

function timingSafeStringEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function audienceMatches(actual, expected) {
  if (!expected) return true;
  const values = Array.isArray(actual) ? actual : [actual];
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  return expectedValues.some((entry) => values.includes(entry));
}

async function fetchJson(url, timeoutMs = 5000) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Falha ao obter metadados OIDC (${response.status}).`);
  return response.json();
}

async function resolveJwksUri(options) {
  if (options.jwksUri) return options.jwksUri;
  if (!options.issuer) throw new Error('issuer ou jwksUri é obrigatório para validação OIDC.');
  const issuer = String(options.issuer).replace(/\/$/, '');
  const discovery = await fetchJson(`${issuer}/.well-known/openid-configuration`, options.timeoutMs);
  if (!discovery.jwks_uri) throw new Error('Provedor OIDC não informou jwks_uri.');
  return discovery.jwks_uri;
}

async function getJwks(options) {
  const uri = await resolveJwksUri(options);
  const current = caches.get(uri);
  if (current && current.expiresAt > Date.now()) return current.keys;
  const payload = await fetchJson(uri, options.timeoutMs);
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  caches.set(uri, { keys, expiresAt: Date.now() + Number(options.cacheTtlMs || 300000) });
  return keys;
}

function verifySignature(alg, signingInput, signature, key, secret) {
  if (alg === 'HS256') {
    if (!secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(signingInput).digest();
    return expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
  }
  const algorithms = {
    RS256: 'RSA-SHA256',
    PS256: 'RSA-SHA256',
    ES256: 'sha256',
    EdDSA: null,
  };
  if (!(alg in algorithms) || !key) return false;
  const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
  const options = alg === 'PS256' ? { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 } : publicKey;
  return crypto.verify(algorithms[alg], Buffer.from(signingInput), options, signature);
}

export async function verifyJwt(token, options = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('JWT inválido.');
  const header = parseJson(base64url(parts[0]));
  const payload = parseJson(base64url(parts[1]));
  const signature = base64url(parts[2]);
  const allowedAlgorithms = options.algorithms || ['RS256', 'PS256', 'ES256', 'EdDSA'];
  if (!allowedAlgorithms.includes(header.alg)) throw new Error(`Algoritmo JWT não permitido: ${header.alg}.`);
  let key = null;
  if (header.alg !== 'HS256') {
    const keys = await getJwks(options);
    key = keys.find((candidate) => candidate.kid === header.kid && (!candidate.alg || candidate.alg === header.alg))
      || keys.find((candidate) => !header.kid && (!candidate.alg || candidate.alg === header.alg));
    if (!key) throw new Error('Chave pública JWT não encontrada.');
  }
  const valid = verifySignature(header.alg, `${parts[0]}.${parts[1]}`, signature, key, options.secret);
  if (!valid) throw new Error('Assinatura JWT inválida.');
  const now = Math.floor(Date.now() / 1000);
  const leeway = Number(options.leewaySeconds || 30);
  if (payload.exp && now > Number(payload.exp) + leeway) throw new Error('JWT expirado.');
  if (payload.nbf && now + leeway < Number(payload.nbf)) throw new Error('JWT ainda não é válido.');
  if (options.issuer && !timingSafeStringEqual(String(payload.iss || ''), String(options.issuer).replace(/\/$/, ''))) throw new Error('Issuer JWT inválido.');
  if (!audienceMatches(payload.aud, options.audience)) throw new Error('Audience JWT inválida.');
  if (options.requiredClaims) {
    for (const [claim, expected] of Object.entries(options.requiredClaims)) {
      const actual = payload[claim];
      const values = Array.isArray(actual) ? actual : [actual];
      const expectedValues = Array.isArray(expected) ? expected : [expected];
      if (!expectedValues.some((value) => values.includes(value))) throw new Error(`Claim JWT obrigatório ausente: ${claim}.`);
    }
  }
  return { header, payload };
}

export function extractBearer(headers = {}) {
  const value = String(headers.authorization || headers.Authorization || '');
  return /^Bearer\s+(.+)$/i.exec(value)?.[1] || '';
}
