import { one, pool } from '@/utils/db/mysqlPool';
import { AppError } from '../errors';
import { can, type Permission } from '../rbac';
import type { Ctx, Role } from '@/utils/types';
import { verifySession } from './jwt';

// The one place a cookie becomes a trusted identity. A valid signature is never enough on its own:
// the person and their organization are re-read from MySQL on every call, so suspending someone or
// an organization takes effect on the very next click.
export async function authenticateToken(
  token: string | undefined | null,
  ip: string | null = null,
): Promise<Ctx> {
  const claims = await verifySession(token);
  const expired = () => new AppError('Your session has expired. Sign in again.', 'UNAUTHENTICATED');
  if (!claims) throw expired();

  const u = await one<{
    id: string;
    name: string;
    email: string;
    role: Role;
    org_id: string | null;
    status: string;
    token_version: number;
  }>(
    pool(),
    'SELECT id, name, email, role, org_id, status, token_version FROM users WHERE id = ?',
    [claims.uid],
  );
  if (!u || u.status !== 'active' || u.token_version !== claims.sv) throw expired();
  // The token says one thing, the database another (role or organization changed): the old session
  // is dead
  if (u.role !== claims.role || (u.org_id ?? null) !== (claims.org ?? null))
    throw new AppError('Your access has changed. Sign in again.', 'UNAUTHENTICATED');

  let org: Ctx['org'] = null;
  if (u.org_id) {
    org =
      (await one<{ id: string; name: string; status: 'active' | 'suspended' }>(
        pool(),
        'SELECT id, name, status FROM organizations WHERE id = ?',
        [u.org_id],
      )) ?? null;
    if (!org) throw expired();
    if (org.status !== 'active')
      throw new AppError('This organization is suspended.', 'ORG_SUSPENDED');
  }
  return {
    user: { id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.org_id },
    org,
    ip,
  };
}

export function assertRole(ctx: Ctx, roles?: Role[]) {
  if (roles && !roles.includes(ctx.user.role))
    throw new AppError('You do not have access to this.', 'FORBIDDEN');
}
export function assertPerm(ctx: Ctx, perm?: Permission) {
  if (perm && !can(ctx.user.role, perm))
    throw new AppError('You do not have permission to do this.', 'FORBIDDEN');
}
// Everything an organization-level person touches is scoped to their own organization
export function orgIdOf(ctx: Ctx): string {
  if (!ctx.user.orgId) throw new AppError('This action needs an organization.', 'FORBIDDEN');
  return ctx.user.orgId;
}

// A system admin works on one organization at a time (passed in). Everyone else is locked to their
// own.
export function scopeOrg(ctx: Ctx, orgId?: string): string {
  if (ctx.user.role === 'system_admin') {
    if (!orgId) throw new AppError('Choose an organization.', 'VALIDATION');
    return orgId;
  }
  return orgIdOf(ctx);
}
