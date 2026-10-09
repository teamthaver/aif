import crypto from 'node:crypto';
import { exec, type Db } from '@/utils/db/mysqlPool';
import { env, isProd } from './env';
import { newId, sha256 } from './server-utils';

// One-time link that lets a new person set a password. Only a hash is stored.
export async function createInvite(c: Db, userId: string) {
  await exec(c, 'DELETE FROM invites WHERE user_id = ? AND used_at IS NULL', [userId]);
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + env().INVITE_TTL_HOURS * 3600_000);
  await exec(c, 'INSERT INTO invites (id, user_id, token_hash, expires_at) VALUES (?,?,?,?)', [
    newId(),
    userId,
    sha256(token),
    expires,
  ]);
  return token;
}
// Invite links are only handed back to the browser outside production
export const exposeToken = (t: string | null | undefined) =>
  isProd() ? undefined : (t ?? undefined);
