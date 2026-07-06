import crypto from 'node:crypto';

const DEFAULT_SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'x-api-key']);
const DEFAULT_SENSITIVE_FIELDS = new Set(['password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'authorization']);

function redactHeaders(headers = {}, extra = []) {
  const sensitive = new Set([...DEFAULT_SENSITIVE_HEADERS, ...extra.map((v) => String(v).toLowerCase())]);
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, sensitive.has(key.toLowerCase()) ? '[REDACTED]' : value]));
}

function redactJson(value, fields) {
  if (Array.isArray(value)) return value.map((entry) => redactJson(entry, fields));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, fields.has(key.toLowerCase()) ? '[REDACTED]' : redactJson(entry, fields)]));
}

function bodyPreview(body, headers, options = {}) {
  if (!body?.length) return { encoding: 'utf8', value: '', truncated: false };
  const maxBytes = Math.max(0, Number(options.maxBodyBytes || 64 * 1024));
  const slice = body.subarray(0, maxBytes);
  const truncated = body.length > slice.length;
  const contentType = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      const fields = new Set([...DEFAULT_SENSITIVE_FIELDS, ...(options.sensitiveJsonFields || []).map((v) => String(v).toLowerCase())]);
      return { encoding: 'json', value: JSON.stringify(redactJson(JSON.parse(slice.toString('utf8')), fields)), truncated };
    } catch {}
  }
  if (contentType.startsWith('text/') || contentType.includes('xml') || contentType.includes('javascript') || contentType.includes('x-www-form-urlencoded')) {
    return { encoding: 'utf8', value: slice.toString('utf8'), truncated };
  }
  return { encoding: 'base64', value: slice.toString('base64'), truncated };
}

export function createInspectionRecord({ organizationId, tunnel, request, response, durationMs, options = {} }) {
  const requestHeaders = redactHeaders(request.headers || {}, options.sensitiveHeaders || []);
  const responseHeaders = redactHeaders(response?.headers || {}, options.sensitiveHeaders || []);
  const requestBody = bodyPreview(request.body || Buffer.alloc(0), request.headers || {}, options);
  const responseBody = bodyPreview(response?.body || Buffer.alloc(0), response?.headers || {}, options);
  return {
    id: crypto.randomUUID(),
    organizationId,
    tunnelId: tunnel.id,
    method: request.method,
    host: request.host,
    path: request.path,
    sourceIp: request.sourceIp || '',
    requestHeaders,
    requestBody,
    responseStatus: Number(response?.status || 0),
    responseHeaders,
    responseBody,
    durationMs: Number(durationMs || 0),
    error: response?.error || null,
  };
}

export function decodeInspectionBody(body = {}) {
  if (!body?.value) return Buffer.alloc(0);
  if (body.encoding === 'base64') return Buffer.from(body.value, 'base64');
  return Buffer.from(String(body.value), 'utf8');
}
