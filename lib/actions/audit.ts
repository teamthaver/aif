'use server';
import type { z } from 'zod';
import { hashEntry } from '@/lib/audit';
import { authorize } from '@/lib/auth/authorize';
import { pool, rows } from '@/utils/db/mysqlPool';
import { asJson, iso } from '@/lib/server-utils';
import type { AuditPage, AuditRow } from '@/utils/types';
import { runAction } from '@/lib/action-result';
import { auditPageSchema } from '@/lib/validators/kyc';

// Shared by the system admin, org admin, compliance manager and auditor pages, and by "Load more"
// in the browser. The system admin sees the whole platform; everyone else sees only their own
// organization.
export async function listAuditAction(input: z.input<typeof auditPageSchema> = {}) {
  return runAction(
    async (): Promise<AuditPage> => {
      const ctx = await authorize({ need: 'audit:view' });
      const { before, limit = 50 } = auditPageSchema.parse(input);
      const scoped = ctx.user.role !== 'system_admin';
      const r = await rows(
        pool(),
        `
          SELECT a.id, a.action, a.entity, a.entity_id AS entityId,
              a.before_json AS beforeJson, a.after_json AS afterJson, a.ip, a.at,
              u.name AS actorName, o.name AS orgName
          FROM audit_log a
          LEFT JOIN users u ON u.id = a.actor_id
          LEFT JOIN organizations o ON o.id = a.org_id
          WHERE (? = 0 OR a.org_id = ?) AND (? IS NULL OR a.id < ?)
          ORDER BY a.id DESC
          LIMIT ?
        `,
        [scoped ? 1 : 0, ctx.user.orgId, before ?? null, before ?? null, limit],
      );
      const entries: AuditRow[] = r.map((x) => ({
        id: Number(x.id),
        action: x.action,
        entity: x.entity,
        entityId: x.entityId,
        ip: x.ip,
        at: iso(x.at)!,
        actorName: x.actorName,
        orgName: x.orgName,
        before: x.beforeJson == null ? null : asJson(x.beforeJson),
        after: x.afterJson == null ? null : asJson(x.afterJson),
      }));
      return {
        entries,
        nextBefore: entries.length === limit ? entries[entries.length - 1].id : null,
      };
    },
    { refresh: false },
  );
}

// Recomputes the whole hash chain. It spans every organization, so only system admins may run it.
export async function verifyAuditAction() {
  return runAction(
    async () => {
      await authorize({ roles: ['system_admin'] });
      const all = await rows(pool(), 'SELECT * FROM audit_log ORDER BY id');
      let prev = '';
      for (const row of all) {
        const entry = {
          prev_hash: row.prev_hash,
          org_id: row.org_id,
          actor_id: row.actor_id,
          action: row.action,
          entity: row.entity,
          entity_id: row.entity_id,
          before: row.before_json == null ? null : asJson(row.before_json),
          after: row.after_json == null ? null : asJson(row.after_json),
          at: new Date(row.at).toISOString(),
        };
        if (row.prev_hash !== prev || hashEntry(entry) !== row.hash)
          return { valid: false, brokenAtId: Number(row.id), checked: all.length };
        prev = row.hash;
      }
      return { valid: true, brokenAtId: null as number | null, checked: all.length };
    },
    { refresh: false },
  );
}
