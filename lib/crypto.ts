import crypto from 'node:crypto';
import { env } from './env';

const key = () => Buffer.from(env().DATA_ENCRYPTION_KEY, 'base64');

// AES-256-GCM. Stored as base64( iv[12] | tag[16] | ciphertext ). Used for PAN and bank account
// numbers.
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
export function decrypt(blob: string): string {
  const b = Buffer.from(blob, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
// Keyed hash: lets us detect a duplicate PAN without being able to read it
export const blindIndex = (value: string) =>
  crypto.createHmac('sha256', key()).update(value).digest('hex');
