'use server';
import type { z } from 'zod';
import { audit } from '@/lib/audit';
import { authorize } from '@/lib/auth/authorize';
import { orgIdOf } from '@/lib/auth/core';
import { exec, one, pool, rows, tx } from '@/utils/db/mysqlPool';
import { AppError } from '@/lib/errors';
import { createInvite, exposeToken } from '@/lib/invites';
import { notifyInvite } from '@/lib/notify';
import { iso, newId, num } from '@/lib/server-utils';
import type { OrgRow } from '@/utils/types';
import { runAction } from '@/lib/action-result';
import { idSchema } from '@/lib/validators/auth';
import {
  createOrgSchema,
  orgProfileSchema,
  orgStatusSchema,
  updateOrgSchema,
} from '@/lib/validators/orgs';

// Creates the organization and invites its first org admin in one step.
export async function createOrgAction(input: z.input<typeof createOrgSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['system_admin'], need: 'organizations:create' });
    const b = createOrgSchema.parse(input);
    const out = await tx(async (c) => {
      if (await one(c, 'SELECT 1 AS x FROM users WHERE email = ?', [b.adminEmail]))
        throw new AppError("A user with the first admin's email already exists.", 'CONFLICT');
      const id = newId(),
        adminId = newId();
      await exec(
        c,
        'INSERT INTO organizations (id, name, registration_no, created_by) VALUES (?,?,?,?)',
        [id, b.name, b.registrationNo ?? null, ctx.user.id],
        // type stays empty: the organization chooses it
      );
      await exec(
        c,
        `
          INSERT INTO users (id, org_id, email, name, role, status, created_by)
          VALUES (?,?,?,?, 'org_admin', 'invited', ?)
        `,
        [adminId, id, b.adminEmail, b.adminName, ctx.user.id],
      );
      const token = await createInvite(c, adminId);
      await audit(c, {
        orgId: id,
        actorId: ctx.user.id,
        action: 'org.create',
        entity: 'organization',
        entityId: id,
        after: { name: b.name, firstAdmin: b.adminEmail },
        ip: ctx.ip,
      });
      return { id, token };
    });
    notifyInvite({ email: b.adminEmail, name: b.adminName, orgName: b.name, token: out.token });
    return { id: out.id, adminEmail: b.adminEmail, inviteToken: exposeToken(out.token) };
  });
}

export async function updateOrgAction(input: z.input<typeof updateOrgSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['system_admin'], need: 'organizations:edit' });
    const b = updateOrgSchema.parse(input);
    await tx(async (c) => {
      const before = await one(
        c,
        'SELECT name, registration_no AS registrationNo FROM organizations WHERE id = ? FOR UPDATE',
        [b.id],
      );
      if (!before) throw new AppError('Organization not found.', 'NOT_FOUND');
      const after = { name: b.name, registrationNo: b.registrationNo ?? null };
      await exec(c, 'UPDATE organizations SET name = ?, registration_no = ? WHERE id = ?', [
        after.name,
        after.registrationNo,
        b.id,
      ]);
      await audit(c, {
        orgId: b.id,
        actorId: ctx.user.id,
        action: 'org.update',
        entity: 'organization',
        entityId: b.id,
        before,
        after,
        ip: ctx.ip,
      });
    });
  });
}

// The organization chooses its own type and registration number. It always acts on the caller's own
// organization, never one named in the request.
export async function updateOwnOrgAction(input: z.input<typeof orgProfileSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['org_admin'], need: 'organizations:profile' });
    const b = orgProfileSchema.parse(input);
    const orgId = orgIdOf(ctx);
    await tx(async (c) => {
      const before = await one(
        c,
        'SELECT type, registration_no AS registrationNo FROM organizations WHERE id = ? FOR UPDATE',
        [orgId],
      );
      if (!before) throw new AppError('Organization not found.', 'NOT_FOUND');
      const after = { type: b.type, registrationNo: b.registrationNo ?? null };
      await exec(c, 'UPDATE organizations SET type = ?, registration_no = ? WHERE id = ?', [
        after.type,
        after.registrationNo,
        orgId,
      ]);
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'org.profile_update',
        entity: 'organization',
        entityId: orgId,
        before,
        after,
        ip: ctx.ip,
      });
    });
  });
}

// Suspending an organization stops all of its people on their next click.
export async function setOrgStatusAction(input: z.input<typeof orgStatusSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['system_admin'], need: 'organizations:edit' });
    const b = orgStatusSchema.parse(input);
    await tx(async (c) => {
      const before = await one(c, 'SELECT status FROM organizations WHERE id = ? FOR UPDATE', [
        b.id,
      ]);
      if (!before) throw new AppError('Organization not found.', 'NOT_FOUND');
      await exec(c, 'UPDATE organizations SET status = ? WHERE id = ?', [b.status, b.id]);
      await audit(c, {
        orgId: b.id,
        actorId: ctx.user.id,
        action: 'org.status',
        entity: 'organization',
        entityId: b.id,
        before: { status: before.status },
        after: { status: b.status },
        ip: ctx.ip,
      });
    });
  });
}

// ---- shared reads: the system admin's organizations page, and an org admin's own organization
// ----
const SELECT_ORG = `
  SELECT
    o.id, o.name, o.type, o.registration_no AS registrationNo, o.status,
    o.created_at AS createdAt,
    (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) AS userCount
  FROM organizations o
`;
const shapeOrg = (r: Record<string, unknown>): OrgRow => ({
  ...(r as OrgRow),
  userCount: num(r.userCount),
  createdAt: iso(r.createdAt as Date)!,
});

// The system admin sees every organization; an org admin sees only their own.
export async function listOrgsAction() {
  return runAction(
    async (): Promise<OrgRow[]> => {
      const ctx = await authorize({ need: 'organizations:view' });
      const r =
        ctx.user.role === 'system_admin'
          ? await rows(pool(), `${SELECT_ORG} ORDER BY o.name`)
          : await rows(pool(), `${SELECT_ORG} WHERE o.id = ?`, [orgIdOf(ctx)]);
      return r.map(shapeOrg);
    },
    { refresh: false },
  );
}

export async function getOrgAction(input: z.input<typeof idSchema>) {
  return runAction(
    async () => {
      const ctx = await authorize({ need: 'organizations:view' });
      const { id } = idSchema.parse(input);
      if (ctx.user.role !== 'system_admin' && id !== ctx.user.orgId)
        throw new AppError('Organization not found.', 'NOT_FOUND');
      const r = await one(pool(), `${SELECT_ORG} WHERE o.id = ?`, [id]);
      if (!r) throw new AppError('Organization not found.', 'NOT_FOUND');
      const counts = await rows<{ role: string; n: number }>(
        pool(),
        'SELECT role, COUNT(*) AS n FROM users WHERE org_id = ? GROUP BY role',
        [id],
      );
      return {
        org: shapeOrg(r),
        roleCounts: Object.fromEntries(counts.map((x) => [x.role, num(x.n)])) as Record<
          string,
          number
        >,
      };
    },
    { refresh: false },
  );
}
