'use server';
import type { z } from 'zod';
import { audit } from '@/lib/audit';
import { authorize } from '@/lib/auth/authorize';
import { scopeOrg } from '@/lib/auth/core';
import { count, exec, one, pool, rows, tx } from '@/utils/db/mysqlPool';
import { AppError } from '@/lib/errors';
import { createInvite, exposeToken } from '@/lib/invites';
import { notifyInvite } from '@/lib/notify';
import { CREATABLE_ROLES, MANAGEABLE_ROLES, VIEWABLE_ROLES } from '@/lib/rbac';
import { iso, newId, num, pageArgs, paged } from '@/lib/server-utils';
import type { Ctx, Paged, Role, UserRow } from '@/utils/types';
import { runAction } from '@/lib/action-result';
import {
  createUserSchema,
  listUsersSchema,
  userIdSchema,
  userStatusSchema,
} from '@/lib/validators/users';

// Who may create which role comes from the matrix in lib/rbac.ts (org admin: anyone; fund manager:
// investors only).
export async function createUserAction(input: z.input<typeof createUserSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'users:create' });
    const b = createUserSchema.parse(input);
    if (!CREATABLE_ROLES[ctx.user.role].includes(b.role))
      throw new AppError(`You cannot create ${b.role.replace('_', ' ')} accounts.`, 'FORBIDDEN');
    // an org admin or fund manager can only ever create inside their own organization
    const orgId = scopeOrg(ctx, b.orgId);
    const out = await tx(async (c) => {
      const org = await one<{ id: string; name: string; status: string }>(
        c,
        'SELECT id, name, status FROM organizations WHERE id = ?',
        [orgId],
      );
      if (!org) throw new AppError('Organization not found.', 'NOT_FOUND');
      if (org.status !== 'active')
        throw new AppError('This organization is suspended.', 'ORG_SUSPENDED');
      if (await one(c, 'SELECT 1 AS x FROM users WHERE email = ?', [b.email]))
        throw new AppError('A user with this email already exists.', 'CONFLICT');
      const id = newId();
      await exec(
        c,
        `
          INSERT INTO users (id, org_id, email, name, role, status, created_by)
          VALUES (?,?,?,?,?, 'invited', ?)
        `,
        [id, orgId, b.email, b.name, b.role, ctx.user.id],
      );
      if (b.role === 'investor')
        // KYC starts here
        await exec(c, 'INSERT INTO investor_profiles (user_id, org_id) VALUES (?, ?)', [id, orgId]);
      const token = await createInvite(c, id);
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'user.create',
        entity: 'user',
        entityId: id,
        after: { email: b.email, role: b.role },
        ip: ctx.ip,
      });
      return { id, token, orgName: org.name };
    });
    notifyInvite({ email: b.email, name: b.name, orgName: out.orgName, token: out.token });
    return { id: out.id, email: b.email, role: b.role, inviteToken: exposeToken(out.token) };
  });
}

// Finds the account to change, locked for the update. Someone outside your organization looks
// exactly like someone who does not exist.
async function targetUser(c: Parameters<typeof one>[0], ctx: Ctx, userId: string) {
  const u = await one<{
    id: string;
    name: string;
    email: string;
    role: Role;
    status: string;
    org_id: string | null;
  }>(c, 'SELECT id, name, email, role, status, org_id FROM users WHERE id = ? FOR UPDATE', [
    userId,
  ]);
  if (
    !u ||
    u.role === 'system_admin' ||
    (ctx.user.role !== 'system_admin' && u.org_id !== ctx.user.orgId)
  )
    throw new AppError('User not found.', 'NOT_FOUND');
  if (!MANAGEABLE_ROLES[ctx.user.role].includes(u.role))
    throw new AppError('You cannot manage this account.', 'FORBIDDEN');
  if (u.id === ctx.user.id) throw new AppError('You cannot change your own access.', 'CONFLICT');
  return u;
}

export async function setUserStatusAction(input: z.input<typeof userStatusSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'users:manage' });
    const b = userStatusSchema.parse(input);
    await tx(async (c) => {
      const u = await targetUser(c, ctx, b.userId);
      if (u.status === 'invited')
        throw new AppError('This person has not accepted their invite yet.', 'CONFLICT');
      if (b.status === 'suspended' && u.role === 'org_admin') {
        const o = await one<{ n: number }>(
          c,
          `
            SELECT COUNT(*) AS n
            FROM users
            WHERE org_id = ? AND role = 'org_admin' AND status = 'active' AND id <> ?
          `,
          [u.org_id, u.id],
        );
        if (Number(o?.n) === 0)
          throw new AppError(
            'An organization must keep at least one active organization admin.',
            'CONFLICT',
          );
      }
      await exec(c, 'UPDATE users SET status = ? WHERE id = ?', [b.status, u.id]);
      await audit(c, {
        orgId: u.org_id,
        actorId: ctx.user.id,
        action: 'user.status',
        entity: 'user',
        entityId: u.id,
        before: { status: u.status },
        after: { status: b.status },
        ip: ctx.ip,
      });
    });
  });
}

export async function resendInviteAction(input: z.input<typeof userIdSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'users:manage' });
    const b = userIdSchema.parse(input);
    const out = await tx(async (c) => {
      const u = await targetUser(c, ctx, b.userId);
      if (u.status !== 'invited')
        throw new AppError('This person has already accepted their invite.', 'CONFLICT');
      const token = await createInvite(c, u.id);
      await audit(c, {
        orgId: u.org_id,
        actorId: ctx.user.id,
        action: 'user.resend_invite',
        entity: 'user',
        entityId: u.id,
        ip: ctx.ip,
      });
      return { token, email: u.email, name: u.name };
    });
    notifyInvite({
      email: out.email,
      name: out.name,
      orgName: ctx.org?.name ?? null,
      token: out.token,
    });
    return { email: out.email, inviteToken: exposeToken(out.token) };
  });
}

// ---- shared read: the people list, used by the system admin (one organization), org admin and
// fund manager panels ----
// What each role sees is decided by VIEWABLE_ROLES in lib/rbac.ts: org admin everyone, fund manager
// investors only.
export async function listUsersAction(input: z.input<typeof listUsersSchema> = {}) {
  return runAction(
    async (): Promise<Paged<UserRow>> => {
      const ctx = await authorize({ need: 'users:view' });
      const b = listUsersSchema.parse(input);
      const orgId = scopeOrg(ctx, b.orgId);
      const allowed = VIEWABLE_ROLES[ctx.user.role].filter(
        (r) => !b.roles || (b.roles as Role[]).includes(r),
      );
      const pg = pageArgs(b);
      if (!allowed.length) return paged<UserRow>([], 0, pg.page, pg.limit);
      const where = `
        u.org_id = ?
        AND u.role IN (?)
        AND (? = '' OR u.name LIKE ? OR u.email LIKE ?)
      `;
      const args = [orgId, allowed, pg.search, pg.like, pg.like];
      const total = await count(pool(), `SELECT COUNT(*) AS n FROM users u WHERE ${where}`, args);
      const r = await rows(
        pool(),
        `
          SELECT u.id, u.name, u.email, u.role, u.status, u.last_login_at AS lastLoginAt,
              u.created_at AS createdAt, p.kyc_status AS kycStatus
          FROM users u
          LEFT JOIN investor_profiles p ON p.user_id = u.id
          WHERE ${where}
          ORDER BY FIELD(u.role,'org_admin','fund_manager','compliance_manager','auditor','investor'),
              u.name
          LIMIT ? OFFSET ?
        `,
        [...args, pg.limit, pg.offset],
      );
      return paged(
        r.map((x) => ({
          ...x,
          lastLoginAt: iso(x.lastLoginAt),
          createdAt: iso(x.createdAt)!,
        })) as UserRow[],
        total,
        pg.page,
        pg.limit,
      );
    },
    { refresh: false },
  );
}
