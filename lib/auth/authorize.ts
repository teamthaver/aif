import 'server-only';
import { AppError } from '../errors';
import { one, pool } from '@/utils/db/mysqlPool';
import { can, type Permission } from '../rbac';
import type { Ctx, KycStatus, Role } from '@/utils/types';
import { authenticateToken } from './core';
import { clientIp, readSessionToken } from './session';

// Validates the cookie against the database: signature, expiry, issuer, audience, then the person,
// their organization and that the role in the token still matches the database. Throws
// UNAUTHENTICATED / ORG_SUSPENDED otherwise.
export async function loadSession(): Promise<Ctx> {
  return authenticateToken(await readSessionToken(), await clientIp());
}

export async function getKycStatus(userId: string): Promise<KycStatus> {
  const p = await one<{ kyc_status: KycStatus }>(
    pool(),
    'SELECT kyc_status FROM investor_profiles WHERE user_id = ?',
    [userId],
  );
  return p?.kyc_status ?? 'not_started';
}

// The first line of every Server Action that needs a signed-in person. In order:
//   1. the session is valid (checked against the database, not just the token)
//   2. the person's role is one of `roles`
//   3. their role holds the permission `need`
//   4. for investors where `verifiedInvestor` is set: KYC must be verified
export async function authorize(
  opts: { roles?: Role[]; need?: Permission; verifiedInvestor?: boolean } = {},
): Promise<Ctx> {
  const ctx = await loadSession();
  if (opts.roles && !opts.roles.includes(ctx.user.role))
    throw new AppError('You do not have access to this.', 'FORBIDDEN');
  if (opts.need && !can(ctx.user.role, opts.need))
    throw new AppError('You do not have permission to do this.', 'FORBIDDEN');
  if (opts.verifiedInvestor) {
    if (ctx.user.role !== 'investor')
      throw new AppError('You do not have access to this.', 'FORBIDDEN');
    if ((await getKycStatus(ctx.user.id)) !== 'verified')
      throw new AppError('Complete your KYC verification first.', 'KYC_REQUIRED');
  }
  return ctx;
}
