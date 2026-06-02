import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';

// ENCRYPTION_KEY doit faire exactement 32 bytes
function getKey() {
  return Buffer.from(env.ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'));
}

export function encrypt(text) {
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(encryptedText) {
  const [ivHex, encHex] = encryptedText.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
