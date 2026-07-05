import { normalizeHostname } from './utils.mjs';

function apiError(status, payload) {
  const messages = Array.isArray(payload?.errors)
    ? payload.errors.map((item) => item?.message || item?.code).filter(Boolean).join('; ')
    : '';
  const error = new Error(messages || payload?.message || `Cloudflare API retornou HTTP ${status}.`);
  error.statusCode = status;
  error.code = 'CLOUDFLARE_API_ERROR';
  error.details = payload?.errors || null;
  return error;
}

export class CloudflareClient {
  constructor({ apiToken, baseUrl = 'https://api.cloudflare.com/client/v4', timeoutMs = 15000 }) {
    if (!apiToken) throw new Error('Cloudflare API Token não informado.');
    this.apiToken = apiToken;
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
    if (!response.ok || payload?.success === false) throw apiError(response.status, payload);
    return payload;
  }

  async verifyToken() {
    const payload = await this.request('/user/tokens/verify');
    return payload.result || { status: 'active' };
  }

  async findZoneId(zoneName) {
    const name = normalizeHostname(zoneName);
    if (!name) throw new Error('Zona Cloudflare inválida.');
    const payload = await this.request(`/zones?name=${encodeURIComponent(name)}&status=active&per_page=50`);
    const zone = (payload.result || []).find((item) => String(item.name).toLowerCase() === name);
    if (!zone) {
      const error = new Error(`Zona ${name} não encontrada ou não acessível pelo token.`);
      error.code = 'CLOUDFLARE_ZONE_NOT_FOUND';
      throw error;
    }
    return zone.id;
  }

  async listRecords(zoneId, { name, type } = {}) {
    const params = new URLSearchParams({ per_page: '100' });
    if (name) params.set('name', normalizeHostname(name) || String(name));
    if (type) params.set('type', String(type).toUpperCase());
    const payload = await this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records?${params}`);
    return payload.result || [];
  }

  async createRecord(zoneId, record) {
    const payload = await this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: 'POST', body: record,
    });
    return payload.result;
  }

  async updateRecord(zoneId, recordId, record) {
    const payload = await this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`, {
      method: 'PATCH', body: record,
    });
    return payload.result;
  }

  async deleteRecord(zoneId, recordId) {
    const payload = await this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
    });
    return payload.result || { id: recordId };
  }

  async ensureRecord(zoneId, { type = 'CNAME', name, content, proxied = false, ttl = 1, comment = 'Managed by Tunnara' }) {
    const rawName = String(name || '').trim().toLowerCase();
    const wildcard = rawName.startsWith('*.');
    const normalizedBase = normalizeHostname(wildcard ? rawName.slice(2) : rawName);
    const normalizedName = normalizedBase ? `${wildcard ? '*.' : ''}${normalizedBase}` : null;
    if (!normalizedName) throw new Error('Nome DNS inválido.');
    const recordType = String(type).toUpperCase();
    const existing = (await this.listRecords(zoneId, { name: normalizedName, type: recordType }))[0];
    const body = { type: recordType, name: normalizedName, content, proxied: Boolean(proxied), ttl: Number(ttl) || 1, comment };
    if (existing) return { action: 'updated', record: await this.updateRecord(zoneId, existing.id, body) };
    return { action: 'created', record: await this.createRecord(zoneId, body) };
  }
}

export function cloudflareRecordTarget({ edgeHostname, edgeAddress }) {
  if (edgeHostname) return { type: 'CNAME', content: normalizeHostname(edgeHostname) || edgeHostname };
  if (edgeAddress && String(edgeAddress).includes(':')) return { type: 'AAAA', content: String(edgeAddress) };
  if (edgeAddress) return { type: 'A', content: String(edgeAddress) };
  throw new Error('Informe edgeHostname ou edgeAddress para criar o DNS da Tunnara.');
}
