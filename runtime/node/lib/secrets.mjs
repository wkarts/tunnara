import crypto from 'node:crypto';

const PREFIX = 'tnrsec:v1';

export function loadMasterKey(value = process.env.TUNNARA_MASTER_KEY_BASE64) {
  if (!value) {
    const error = new Error('TUNNARA_MASTER_KEY_BASE64 é obrigatória para armazenar integrações com segredos.');
    error.code = 'MASTER_KEY_REQUIRED';
    throw error;
  }
  let key;
  try { key = Buffer.from(String(value), 'base64'); } catch { key = null; }
  if (!key || key.length !== 32) {
    const error = new Error('TUNNARA_MASTER_KEY_BASE64 deve representar exatamente 32 bytes em Base64.');
    error.code = 'MASTER_KEY_INVALID';
    throw error;
  }
  return key;
}

export function encryptSecret(plaintext, key = loadMasterKey()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(serialized, key = loadMasterKey()) {
  const parts = String(serialized || '').split(':');
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    const error = new Error('Segredo criptografado em formato inválido.');
    error.code = 'SECRET_FORMAT_INVALID';
    throw error;
  }
  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const encrypted = Buffer.from(parts[4], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function generateMasterKey() {
  return crypto.randomBytes(32).toString('base64');
}
