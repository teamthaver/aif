import type { PoolConnection } from 'mysql2/promise';
import { exec, one } from '@/utils/db/mysqlPool';
import { canonical, sha256 } from './server-utils';

export type AuditEntry = {
  prev_hash: string;
  org_id: string | null;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  at: string;
};
export const hashEntry = (e: AuditEntry) =>
  sha256(
    canonical([
      e.prev_hash,
      e.org_id,
      e.actor_id,
      e.action,
      e.entity,
      e.entity_id,
      e.before,
      e.after,
      e.at,
    ]),
  );

export type AuditInput = {
  orgId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

// Call inside the same transaction as the change. Locking the audit_head row keeps the chain
// strictly ordered.
export async function audit(c: PoolConnection, e: AuditInput) {
  const head = await one<{ last_hash: string }>(
    c,
    'SELECT last_hash FROM audit_head WHERE id = 1 FOR UPDATE',
  );
  const at = new Date();
  const entry: AuditEntry = {
    prev_hash: head?.last_hash ?? '',
    org_id: e.orgId ?? null,
    actor_id: e.actorId ?? null,
    action: e.action,
    entity: e.entity,
    entity_id: e.entityId ?? null,
    before: e.before ?? null,
    after: e.after ?? null,
    at: at.toISOString(),
  };
  const hash = hashEntry(entry);
  await exec(
    c,
    `
      INSERT INTO audit_log (org_id, actor_id, action, entity, entity_id, before_json, after_json, ip, at, prev_hash, hash)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      entry.org_id,
      entry.actor_id,
      entry.action,
      entry.entity,
      entry.entity_id,
      e.before == null ? null : JSON.stringify(e.before),
      e.after == null ? null : JSON.stringify(e.after),
      e.ip ?? null,
      at,
      entry.prev_hash,
      hash,
    ],
  );
  await exec(c, 'UPDATE audit_head SET last_hash = ? WHERE id = 1', [hash]);
}
