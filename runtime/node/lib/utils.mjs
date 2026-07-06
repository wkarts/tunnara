import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VERSION = '1.1.1';
export const DEFAULT_MAX_BODY = 10 * 1024 * 1024;

export function nowIso() { return new Date().toISOString(); }
export function uuid() { return crypto.randomUUID(); }
export function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
export function randomToken(prefix = 'tnr') { return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`; }
export function agentAuthMessage({ agentId, timestamp, nonce, sessionToken }) {
  return Buffer.from(`TUNNARA_AGENT_AUTH_V1\n${agentId}\n${timestamp}\n${nonce}\n${sessionToken}`, 'utf8');
}
export function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
export function atomicWriteJson(file, data, mode = 0o600) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, mode); } catch {}
}
export function readJsonFile(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
export function slugify(value) {
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return normalized || `org-${crypto.randomBytes(4).toString('hex')}`;
}
export function normalizeHostname(value) {
  const host = String(value ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '');
  if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes('..')) return null;
  return host;
}
export function isLoopbackHost(value) {
  const host = String(value).toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}
export function parseCli(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const eq = arg.indexOf('=');
    if (eq > 2) { options[arg.slice(2, eq)] = arg.slice(eq + 1); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { options[key] = next; i += 1; }
    else options[key] = true;
  }
  return { positional, options };
}
export function log(service, level, message, fields = {}) {
  const row = { timestamp: nowIso(), level, service, message, ...fields };
  const line = process.env.TUNNARA_LOG_FORMAT === 'json'
    ? JSON.stringify(row)
    : `[${row.timestamp}] ${level.toUpperCase()} ${service}: ${message}${Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : ''}`;
  (level === 'error' ? console.error : console.log)(line);
}
export async function readRequestBody(req, maxBytes = DEFAULT_MAX_BODY) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error(`Corpo excede o limite de ${maxBytes} bytes.`);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function readJsonBody(req, maxBytes = DEFAULT_MAX_BODY) {
  const body = await readRequestBody(req, maxBytes);
  if (!body.length) return {};
  try { return JSON.parse(body.toString('utf8')); }
  catch {
    const error = new Error('JSON inválido.');
    error.statusCode = 400;
    throw error;
  }
}
export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}
export function publicError(error) {
  return { error: error.code ?? 'TUNNARA_ERROR', message: error.message ?? String(error) };
}
export function bearerToken(req) {
  const value = String(req.headers.authorization ?? '');
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}
export function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
