'use server';
import { authorize } from '@/lib/auth/authorize';
import { orgIdOf } from '@/lib/auth/core';
import { one, pool, rows } from '@/utils/db/mysqlPool';
import { num } from '@/lib/server-utils';
import { runAction } from '@/lib/action-result';

export async function platformStatsAction() {
  return runAction(
    async () => {
      await authorize({ roles: ['system_admin'], need: 'organizations:view' });
      const o = await rows<{ status: string; n: number }>(
        pool(),
        'SELECT status, COUNT(*) AS n FROM organizations GROUP BY status',
      );
      const u = await one<{ n: number }>(
        pool(),
        `SELECT COUNT(*) AS n FROM users WHERE role <> 'system_admin'`,
      );
      return {
        activeOrgs: num(o.find((x) => x.status === 'active')?.n),
        suspendedOrgs: num(o.find((x) => x.status === 'suspended')?.n),
        users: num(u?.n),
      };
    },
    { refresh: false },
  );
}

// The overview for org admin, fund manager, compliance manager and auditor. They all hold
// funds:view.
export async function orgStatsAction() {
  return runAction(
    async () => {
      const ctx = await authorize({ need: 'funds:view' });
      const id = orgIdOf(ctx);
      const roles = await rows<{ role: string; n: number }>(
        pool(),
        'SELECT role, COUNT(*) AS n FROM users WHERE org_id = ? GROUP BY role',
        [id],
      );
      const kyc = await rows<{ kyc_status: string; n: number }>(
        pool(),
        `
          SELECT kyc_status, COUNT(*) AS n
          FROM investor_profiles
          WHERE org_id = ?
          GROUP BY kyc_status
        `,
        [id],
      );
      const funds = await rows<{ status: string; n: number }>(
        pool(),
        'SELECT status, COUNT(*) AS n FROM funds WHERE org_id = ? GROUP BY status',
        [id],
      );
      const money = await one<{ s: string }>(
        pool(),
        `
          SELECT COALESCE(SUM(commitment_amount),0) AS s
          FROM fund_investors
          WHERE org_id = ? AND status = 'active'
        `,
        [id],
      );
      const by = <T extends Record<string, unknown>>(arr: T[], k: keyof T) =>
        Object.fromEntries(arr.map((x) => [String(x[k]), num(x.n)])) as Record<string, number>;
      return {
        roles: by(roles, 'role'),
        kyc: by(kyc, 'kyc_status'),
        funds: by(funds, 'status'),
        committed: num(money?.s),
      };
    },
    { refresh: false },
  );
}

export async function investorSummaryAction() {
  return runAction(
    async () => {
      const ctx = await authorize({ roles: ['investor'], verifiedInvestor: true });
      const r = await one<{ n: number; s: string; open: number }>(
        pool(),
        `
          SELECT COUNT(*) AS n, COALESCE(SUM(fi.commitment_amount),0) AS s,
              SUM(fi.accepted_at IS NULL AND f.status = 'open') AS open
          FROM fund_investors fi
          JOIN funds f ON f.id = fi.fund_id
          WHERE fi.investor_id = ? AND fi.status = 'active' AND f.status <> 'draft'
        `,
        [ctx.user.id],
      );
      return { funds: num(r?.n), committed: num(r?.s), awaitingConfirmation: num(r?.open) };
    },
    { refresh: false },
  );
}
