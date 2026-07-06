import crypto from 'node:crypto';
import net from 'node:net';
import { extractBearer, verifyJwt } from './jwt.mjs';
import { policyDecisions } from './metrics.mjs';

const rateBuckets = new Map();
const normalizeHeaderMap = (headers = {}) => Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value);
const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => isPlainObject(value) ? value : {};
const safeRegex = (pattern) => {
  if (typeof pattern !== 'string' || pattern.length > 512) return null;
  // Evita padrões comuns de backtracking catastrófico. Expressões complexas devem ser testadas antes da publicação.
  if (/(\([^)]*[+*][^)]*\))[+*{]/.test(pattern) || /([+*])\1/.test(pattern)) return null;
  try { return new RegExp(pattern); } catch { return null; }
};

function ipv4ToInt(ip) {
  const parts = String(ip).replace(/^::ffff:/, '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function cidrContains(cidr, ip) {
  if (!net.isIP(String(ip).replace(/^::ffff:/, '')) || !String(cidr).includes('/')) return false;
  const [network, rawPrefix] = String(cidr).split('/');
  const prefix = Number(rawPrefix);
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

function matchRule(match = {}, context) {
  const methods = list(match.methods);
  if (methods.length && !methods.map((v) => String(v).toUpperCase()).includes(context.method)) return false;
  if (match.pathPrefix && !context.path.startsWith(String(match.pathPrefix))) return false;
  if (match.pathRegex) {
    const regex = safeRegex(match.pathRegex);
    if (!regex || !regex.test(context.path)) return false;
  }
  if (match.host && String(match.host).toLowerCase() !== context.host) return false;
  const sourceCidrs = list(match.sourceCidrs);
  if (sourceCidrs.length && !sourceCidrs.some((cidr) => cidrContains(cidr, context.sourceIp))) return false;
  const headers = context.headers;
  for (const [name, expected] of Object.entries(object(match.headers))) {
    const actual = String(headers[String(name).toLowerCase()] ?? '');
    if (typeof expected === 'string' && actual !== expected) return false;
    if (expected && typeof expected === 'object') {
      if (expected.equals !== undefined && actual !== String(expected.equals)) return false;
      if (expected.contains !== undefined && !actual.includes(String(expected.contains))) return false;
      if (expected.regex !== undefined) {
        const regex = safeRegex(expected.regex);
        if (!regex || !regex.test(actual)) return false;
      }
    }
  }
  return true;
}

function verifyPassword(password, encoded) {
  if (!encoded) return false;
  const [algorithm, salt, expected] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64url'), 32);
  const expectedBuffer = Buffer.from(expected, 'base64url');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

export function hashPolicySecret(value) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(String(value), salt, 32);
  return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

function rateLimit(action, context, policyId) {
  const limit = Math.max(1, Number(action.requests || 60));
  const windowSeconds = Math.max(1, Number(action.windowSeconds || 60));
  const keyTemplate = String(action.key || 'sourceIp');
  const identity = keyTemplate === 'host' ? context.host
    : keyTemplate === 'tunnel' ? context.tunnelId
      : keyTemplate.startsWith('header:') ? String(context.headers[keyTemplate.slice(7).toLowerCase()] || '')
        : context.sourceIp;
  const key = `${policyId}:${identity}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > limit) return { allowed: false, status: 429, code: 'POLICY_RATE_LIMIT', message: 'Limite de requisições excedido.', headers: { 'retry-after': String(Math.ceil((bucket.resetAt - now) / 1000)) } };
  return null;
}

async function executeAction(action, context, result, policyId) {
  const type = String(action.type || '').toLowerCase();
  if (type === 'allow') { result.allowed = true; return { terminal: true }; }
  if (type === 'deny') {
    result.allowed = false; result.status = Number(action.status || 403); result.code = action.code || 'POLICY_DENIED'; result.message = action.message || 'Acesso negado pela política.';
    return { terminal: true };
  }
  if (type === 'redirect') {
    result.allowed = false; result.status = Number(action.status || 302); result.code = 'POLICY_REDIRECT'; result.message = 'Redirecionamento definido pela política.';
    result.responseHeaders.location = String(action.location || '/');
    return { terminal: true };
  }
  if (type === 'rate_limit') {
    const denied = rateLimit(action, context, policyId);
    if (denied) { Object.assign(result, denied); Object.assign(result.responseHeaders, denied.headers || {}); return { terminal: true }; }
    return {};
  }
  if (type === 'basic_auth') {
    const value = String(context.headers.authorization || '');
    const encoded = /^Basic\s+(.+)$/i.exec(value)?.[1] || '';
    let username = ''; let password = '';
    try { [username, password] = Buffer.from(encoded, 'base64').toString('utf8').split(':', 2); } catch {}
    const account = list(action.accounts).find((entry) => entry.username === username);
    if (!account || !verifyPassword(password, account.passwordHash)) {
      result.allowed = false; result.status = 401; result.code = 'POLICY_BASIC_AUTH'; result.message = 'Autenticação obrigatória.';
      result.responseHeaders['www-authenticate'] = `Basic realm="${String(action.realm || 'Tunnara')}"`;
      return { terminal: true };
    }
    result.identity = { type: 'basic', subject: username };
    return {};
  }
  if (type === 'api_key') {
    const raw = action.header ? context.headers[String(action.header).toLowerCase()] : action.query ? context.url.searchParams.get(action.query) : '';
    const digest = crypto.createHash('sha256').update(String(raw || '')).digest('hex');
    const valid = list(action.hashes).some((hash) => {
      const expected = Buffer.from(String(hash)); const actual = Buffer.from(digest);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    });
    if (!valid) { result.allowed = false; result.status = 401; result.code = 'POLICY_API_KEY'; result.message = 'API key inválida.'; return { terminal: true }; }
    result.identity = { type: 'api_key', subject: digest.slice(0, 12) };
    return {};
  }
  if (type === 'jwt' || type === 'oidc') {
    const token = extractBearer(context.headers);
    if (!token) { result.allowed = false; result.status = 401; result.code = 'POLICY_JWT_REQUIRED'; result.message = 'Bearer token obrigatório.'; return { terminal: true }; }
    try {
      const verified = await verifyJwt(token, action);
      result.identity = { type: 'jwt', subject: verified.payload.sub || '', claims: verified.payload };
      if (action.forwardClaimsHeader) result.requestHeaders[String(action.forwardClaimsHeader).toLowerCase()] = Buffer.from(JSON.stringify(verified.payload)).toString('base64url');
    } catch (error) {
      result.allowed = false; result.status = 401; result.code = 'POLICY_JWT_INVALID'; result.message = error.message; return { terminal: true };
    }
    return {};
  }
  if (type === 'add_request_headers') {
    Object.assign(result.requestHeaders, Object.fromEntries(Object.entries(object(action.headers)).map(([k, v]) => [k.toLowerCase(), String(v)])));
    return {};
  }
  if (type === 'remove_request_headers') {
    for (const name of list(action.headers)) result.removeRequestHeaders.add(String(name).toLowerCase());
    return {};
  }
  if (type === 'add_response_headers') {
    Object.assign(result.responseHeaders, Object.fromEntries(Object.entries(object(action.headers)).map(([k, v]) => [k.toLowerCase(), String(v)])));
    return {};
  }
  if (type === 'remove_response_headers') {
    for (const name of list(action.headers)) result.removeResponseHeaders.add(String(name).toLowerCase());
    return {};
  }
  if (type === 'rewrite_path') {
    if (action.fromPrefix !== undefined && context.path.startsWith(String(action.fromPrefix))) result.path = `${String(action.toPrefix || '')}${context.path.slice(String(action.fromPrefix).length)}` || '/';
    else if (action.regex) {
      const regex = safeRegex(action.regex);
      if (regex) result.path = context.path.replace(regex, String(action.replacement || '')) || '/';
    }
  }
  return {};
}

export async function evaluatePolicy(policy, requestContext) {
  const context = {
    ...requestContext,
    method: String(requestContext.method || 'GET').toUpperCase(),
    host: String(requestContext.host || '').toLowerCase(),
    path: String(requestContext.path || '/'),
    headers: normalizeHeaderMap(requestContext.headers),
    url: requestContext.url instanceof URL ? requestContext.url : new URL(String(requestContext.path || '/'), `http://${requestContext.host || 'localhost'}`),
  };
  const result = {
    allowed: policy?.defaultEffect !== 'deny',
    status: 403,
    code: 'POLICY_DENIED',
    message: 'Acesso negado pela política.',
    path: context.path,
    requestHeaders: {},
    responseHeaders: {},
    removeRequestHeaders: new Set(),
    removeResponseHeaders: new Set(),
    identity: null,
    matchedRules: [],
  };
  if (!policy || policy.enabled === false) return result;
  for (const rule of list(policy.rules)) {
    if (rule.enabled === false || !matchRule(rule.match || {}, context)) continue;
    result.matchedRules.push(rule.name || rule.id || 'unnamed');
    for (const action of list(rule.actions)) {
      const outcome = await executeAction(action, context, result, policy.id || 'policy');
      if (outcome.terminal) break;
    }
    if (rule.stop !== false) break;
  }
  policyDecisions.inc({ policy: policy.id || 'none', effect: result.allowed ? 'allow' : 'deny' });
  return result;
}

export function normalizePolicyDocument(document = {}) {
  const source = object(document);
  return {
    version: '1',
    defaultEffect: source.defaultEffect === 'deny' ? 'deny' : 'allow',
    enabled: source.enabled !== false,
    rules: list(source.rules).slice(0, 200).map((rawRule, index) => {
      const rule = object(rawRule);
      const rawMatch = object(rule.match);
      return {
        id: String(rule.id || `rule-${index + 1}`).slice(0, 160),
        name: String(rule.name || `Regra ${index + 1}`).slice(0, 240),
        enabled: rule.enabled !== false,
        stop: rule.stop !== false,
        match: {
          methods: list(rawMatch.methods).slice(0, 32).map((item) => String(item).toUpperCase()),
          pathPrefix: typeof rawMatch.pathPrefix === 'string' ? rawMatch.pathPrefix.slice(0, 4096) : undefined,
          pathRegex: typeof rawMatch.pathRegex === 'string' ? rawMatch.pathRegex.slice(0, 512) : undefined,
          host: typeof rawMatch.host === 'string' ? rawMatch.host.toLowerCase().slice(0, 255) : undefined,
          sourceCidrs: list(rawMatch.sourceCidrs).slice(0, 256).map(String),
          headers: object(rawMatch.headers),
        },
        actions: list(rule.actions).slice(0, 100).map((rawAction) => object(rawAction)),
      };
    }),
  };
}
