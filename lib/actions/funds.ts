'use server';
import type { z } from 'zod';
import { audit } from '@/lib/audit';
import { authorize } from '@/lib/auth/authorize';
import { orgIdOf } from '@/lib/auth/core';
import { count, exec, one, pool, rows, tx, type Db } from '@/utils/db/mysqlPool';
import { AppError } from '@/lib/errors';
import { iso, newId, num, pageArgs, paged } from '@/lib/server-utils';
import type {
  AssignmentRow,
  FundRow,
  Paged,
  FundStatus,
  InvestorOption,
  MyFundRow,
} from '@/utils/types';
import { runAction } from '@/lib/action-result';
import { idSchema } from '@/lib/validators/auth';
import {
  assignSchema,
  assignmentIdSchema,
  createFundSchema,
  fundIdSchema,
  fundListSchema,
  fundStatusSchema,
  updateAssignmentSchema,
  updateFundSchema,
} from '@/lib/validators/funds';

// ---- small helpers used by several actions in this file ----
const lockFund = async (c: Db, id: string, orgId: string) => {
  const f = await one(c, 'SELECT * FROM funds WHERE id = ? AND org_id = ? FOR UPDATE', [id, orgId]);
  if (!f) throw new AppError('Fund not found.', 'NOT_FOUND');
  return f;
};
const committedOf = async (c: Db, fundId: string, exceptAssignment?: string) =>
  num(
    (
      await one(
        c,
        `
          SELECT COALESCE(SUM(commitment_amount),0) AS s
          FROM fund_investors
          WHERE fund_id = ? AND status = 'active' AND (? IS NULL OR id <> ?)
        `,
        [fundId, exceptAssignment ?? null, exceptAssignment ?? null],
      )
    )?.s,
  );
const lockAssignment = async (c: Db, id: string, orgId: string) => {
  const a = await one(
    c,
    `
      SELECT fi.*, f.code AS fund_code, f.status AS fund_status, f.target_size,
          f.min_commitment, u.name AS investor_name
      FROM fund_investors fi
      JOIN funds f ON f.id = fi.fund_id
      JOIN users u ON u.id = fi.investor_id
      WHERE fi.id = ? AND fi.org_id = ?
      FOR UPDATE
    `,
    [id, orgId],
  );
  if (!a) throw new AppError('Assignment not found.', 'NOT_FOUND');
  if (!['draft', 'open'].includes(a.fund_status))
    throw new AppError('This fund is no longer accepting changes to its investors.', 'CONFLICT');
  return a;
};
const NEXT: Record<FundStatus, FundStatus[]> = {
  draft: ['open'],
  open: ['closed'],
  closed: ['open', 'wound_up'],
  wound_up: [],
};

// ---- funds: only the fund manager holds funds:create and funds:edit ----
export async function createFundAction(input: z.input<typeof createFundSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'funds:create' });
    const b = createFundSchema.parse(input);
    const orgId = orgIdOf(ctx);
    return tx(async (c) => {
      if (await one(c, 'SELECT 1 AS x FROM funds WHERE org_id = ? AND code = ?', [orgId, b.code]))
        throw new AppError(`A fund with code ${b.code} already exists.`, 'CONFLICT');
      const id = newId();
      await exec(
        c,
        `
          INSERT INTO funds (id, org_id, code, name, category, strategy, description, target_size, min_commitment, tenure_years, created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
          id,
          orgId,
          b.code,
          b.name,
          b.category,
          b.strategy ?? null,
          b.description ?? null,
          b.targetSize,
          b.minCommitment,
          b.tenureYears,
          ctx.user.id,
        ],
      );
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'fund.create',
        entity: 'fund',
        entityId: id,
        after: { code: b.code, name: b.name, category: b.category, targetSize: b.targetSize },
        ip: ctx.ip,
      });
      return { id };
    });
  });
}

export async function updateFundAction(input: z.input<typeof updateFundSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'funds:edit' });
    const b = updateFundSchema.parse(input);
    const orgId = orgIdOf(ctx);
    await tx(async (c) => {
      const f = await lockFund(c, b.id, orgId);
      if (f.status === 'wound_up')
        throw new AppError('A wound-up fund cannot be edited.', 'CONFLICT');
      if (
        b.code !== f.code &&
        (await one(c, 'SELECT 1 AS x FROM funds WHERE org_id = ? AND code = ? AND id <> ?', [
          orgId,
          b.code,
          b.id,
        ]))
      )
        throw new AppError(`A fund with code ${b.code} already exists.`, 'CONFLICT');
      if (b.targetSize < (await committedOf(c, b.id)))
        throw new AppError(
          'The target size cannot be lower than what is already committed.',
          'CONFLICT',
        );
      await exec(
        c,
        `
          UPDATE funds
          SET code=?, name=?, category=?, strategy=?, description=?, target_size=?,
              min_commitment=?, tenure_years=?
          WHERE id=?
        `,
        [
          b.code,
          b.name,
          b.category,
          b.strategy ?? null,
          b.description ?? null,
          b.targetSize,
          b.minCommitment,
          b.tenureYears,
          b.id,
        ],
      );
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'fund.update',
        entity: 'fund',
        entityId: b.id,
        before: {
          name: f.name,
          targetSize: num(f.target_size),
          minCommitment: num(f.min_commitment),
        },
        after: { name: b.name, targetSize: b.targetSize, minCommitment: b.minCommitment },
        ip: ctx.ip,
      });
    });
  });
}

export async function setFundStatusAction(input: z.input<typeof fundStatusSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'funds:edit' });
    const b = fundStatusSchema.parse(input);
    const orgId = orgIdOf(ctx);
    await tx(async (c) => {
      const f = await lockFund(c, b.id, orgId);
      if (!NEXT[f.status as FundStatus].includes(b.status))
        throw new AppError(
          `A ${f.status.replace('_', ' ')} fund cannot move to ${b.status.replace('_', ' ')}.`,
          'CONFLICT',
        );
      await exec(c, 'UPDATE funds SET status = ? WHERE id = ?', [b.status, b.id]);
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'fund.status',
        entity: 'fund',
        entityId: b.id,
        before: { status: f.status },
        after: { status: b.status },
        ip: ctx.ip,
      });
    });
  });
}

// ---- assigning and maintaining investors: fund manager only (assignments:manage) ----
export async function assignInvestorAction(input: z.input<typeof assignSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'assignments:manage' });
    const b = assignSchema.parse(input);
    const orgId = orgIdOf(ctx);
    return tx(async (c) => {
      const f = await lockFund(c, b.fundId, orgId);
      if (!['draft', 'open'].includes(f.status))
        throw new AppError('Investors can only be assigned to draft or open funds.', 'CONFLICT');
      const inv = await one(
        c,
        `
          SELECT u.id, u.name, u.status, p.kyc_status
          FROM users u
          JOIN investor_profiles p ON p.user_id = u.id
          WHERE u.id = ? AND u.org_id = ? AND u.role = 'investor'
        `,
        [b.investorId, orgId],
      );
      if (!inv) throw new AppError('Investor not found.', 'NOT_FOUND');
      if (inv.status !== 'active')
        throw new AppError('This investor has not activated their account.', 'CONFLICT');
      if (inv.kyc_status !== 'verified')
        throw new AppError(
          'Only investors with verified KYC can be assigned to a fund.',
          'KYC_REQUIRED',
        );
      if (b.commitmentAmount < num(f.min_commitment))
        throw new AppError("The commitment is below the fund's minimum.", 'VALIDATION');
      if ((await committedOf(c, f.id)) + b.commitmentAmount > num(f.target_size))
        throw new AppError('This would take the fund above its target size.', 'CONFLICT');
      const existing = await one(
        c,
        'SELECT id, status FROM fund_investors WHERE fund_id = ? AND investor_id = ? FOR UPDATE',
        [f.id, b.investorId],
      );
      if (existing?.status === 'active')
        throw new AppError('This investor is already in the fund.', 'CONFLICT');
      const id = existing?.id ?? newId();
      if (existing)
        await exec(
          c,
          `
            UPDATE fund_investors
            SET status='active', commitment_amount=?, notes=?, accepted_at=NULL, assigned_by=?
            WHERE id=?
          `,
          [b.commitmentAmount, b.notes ?? null, ctx.user.id, id],
        );
      else
        await exec(
          c,
          `
            INSERT INTO fund_investors (id, fund_id, org_id, investor_id, commitment_amount, notes, assigned_by)
            VALUES (?,?,?,?,?,?,?)
          `,
          [id, f.id, orgId, b.investorId, b.commitmentAmount, b.notes ?? null, ctx.user.id],
        );
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'fund.assign_investor',
        entity: 'fund_investor',
        entityId: id,
        after: { fund: f.code, investor: inv.name, commitment: b.commitmentAmount },
        ip: ctx.ip,
      });
      return { id };
    });
  });
}

export async function updateAssignmentAction(input: z.input<typeof updateAssignmentSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'assignments:manage' });
    const b = updateAssignmentSchema.parse(input);
    const orgId = orgIdOf(ctx);
    await tx(async (c) => {
      const a = await lockAssignment(c, b.assignmentId, orgId);
      if (a.status !== 'active')
        throw new AppError(
          'This investor was removed from the fund. Assign them again instead.',
          'CONFLICT',
        );
      if (b.commitmentAmount < num(a.min_commitment))
        throw new AppError("The commitment is below the fund's minimum.", 'VALIDATION');
      if ((await committedOf(c, a.fund_id, a.id)) + b.commitmentAmount > num(a.target_size))
        throw new AppError('This would take the fund above its target size.', 'CONFLICT');
      const changed = b.commitmentAmount !== num(a.commitment_amount);
      // A new amount needs the investor's fresh confirmation
      await exec(
        c,
        'UPDATE fund_investors SET commitment_amount = ?, notes = ?, accepted_at = ? WHERE id = ?',
        [b.commitmentAmount, b.notes ?? null, changed ? null : a.accepted_at, a.id],
      );
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'fund.update_commitment',
        entity: 'fund_investor',
        entityId: a.id,
        before: { commitment: num(a.commitment_amount) },
        after: { fund: a.fund_code, investor: a.investor_name, commitment: b.commitmentAmount },
        ip: ctx.ip,
      });
    });
  });
}

export async function removeAssignmentAction(input: z.input<typeof assignmentIdSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'assignments:manage' });
    const b = assignmentIdSchema.parse(input);
    const orgId = orgIdOf(ctx);
    await tx(async (c) => {
      const a = await lockAssignment(c, b.assignmentId, orgId);
      if (a.status !== 'active') throw new AppError('Already removed.', 'CONFLICT');
      await exec(c, `UPDATE fund_investors SET status = 'removed' WHERE id = ?`, [a.id]);
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: 'fund.remove_investor',
        entity: 'fund_investor',
        entityId: a.id,
        before: { commitment: num(a.commitment_amount) },
        after: { fund: a.fund_code, investor: a.investor_name, status: 'removed' },
        ip: ctx.ip,
      });
    });
  });
}

// ---- the investor's own action: only after KYC is verified ----
export async function acceptCommitmentAction(input: z.input<typeof assignmentIdSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['investor'], verifiedInvestor: true });
    const b = assignmentIdSchema.parse(input);
    await tx(async (c) => {
      const a = await one(
        c,
        `
          SELECT fi.*, f.status AS fund_status, f.code
          FROM fund_investors fi
          JOIN funds f ON f.id = fi.fund_id
          WHERE fi.id = ? AND fi.investor_id = ? AND fi.status = 'active'
          FOR UPDATE
        `,
        [b.assignmentId, ctx.user.id],
      );
      if (!a || a.fund_status === 'draft') throw new AppError('Commitment not found.', 'NOT_FOUND');
      if (a.fund_status !== 'open')
        throw new AppError('This fund is not open for confirmations.', 'CONFLICT');
      if (a.accepted_at)
        throw new AppError('You have already confirmed this commitment.', 'CONFLICT');
      await exec(c, 'UPDATE fund_investors SET accepted_at = ? WHERE id = ?', [new Date(), a.id]);
      await audit(c, {
        orgId: a.org_id,
        actorId: ctx.user.id,
        action: 'investor.accept_commitment',
        entity: 'fund_investor',
        entityId: a.id,
        after: { fund: a.code, commitment: num(a.commitment_amount) },
        ip: ctx.ip,
      });
    });
  });
}

// ---- shared reads. Four panels list funds, so there is ONE action and the roles allowed to call
// it are decided by `need`. ----
const FUND_SQL = `
  SELECT
    f.id, f.code, f.name, f.category, f.strategy, f.description, f.currency,
    f.target_size AS targetSize, f.min_commitment AS minCommitment,
    f.tenure_years AS tenureYears, f.status, f.created_at AS createdAt,
    (SELECT COALESCE(SUM(fi.commitment_amount), 0)
       FROM fund_investors fi
       WHERE fi.fund_id = f.id AND fi.status = 'active') AS committed,
    (SELECT COUNT(*)
       FROM fund_investors fi
       WHERE fi.fund_id = f.id AND fi.status = 'active') AS investorCount
  FROM funds f
`;
const shapeFund = (r: Record<string, unknown>): FundRow => ({
  ...(r as FundRow),
  targetSize: num(r.targetSize),
  minCommitment: num(r.minCommitment),
  tenureYears: num(r.tenureYears),
  committed: num(r.committed),
  investorCount: num(r.investorCount),
  createdAt: iso(r.createdAt as Date)!,
});

// funds:view is held by org admin, fund manager, compliance manager and auditor
export async function listFundsAction(input: z.input<typeof fundListSchema> = {}) {
  return runAction(
    async (): Promise<Paged<FundRow>> => {
      const ctx = await authorize({ need: 'funds:view' });
      const pg = pageArgs(fundListSchema.parse(input));
      const args = [orgIdOf(ctx), pg.search, pg.like, pg.like];
      const where = `f.org_id = ? AND (? = '' OR f.name LIKE ? OR f.code LIKE ?)`;
      const total = await count(pool(), `SELECT COUNT(*) AS n FROM funds f WHERE ${where}`, args);
      const r = await rows(
        pool(),
        `${FUND_SQL} WHERE ${where} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
        [...args, pg.limit, pg.offset],
      );
      return paged(r.map(shapeFund), total, pg.page, pg.limit);
    },
    { refresh: false },
  );
}

export async function getFundAction(input: z.input<typeof idSchema>) {
  return runAction(
    async (): Promise<{ fund: FundRow; assignments: AssignmentRow[] }> => {
      const ctx = await authorize({ need: 'funds:view' });
      const { id } = idSchema.parse(input);
      const r = await one(pool(), `${FUND_SQL} WHERE f.id = ? AND f.org_id = ?`, [
        id,
        orgIdOf(ctx),
      ]);
      // another organization's fund looks like it does not exist
      if (!r) throw new AppError('Fund not found.', 'NOT_FOUND');
      const a = await rows(
        pool(),
        `
          SELECT fi.id, fi.investor_id AS investorId, u.name AS investorName,
              u.email AS investorEmail, fi.commitment_amount AS commitmentAmount, fi.status,
              fi.notes, fi.accepted_at AS acceptedAt, fi.created_at AS createdAt
          FROM fund_investors fi
          JOIN users u ON u.id = fi.investor_id
          WHERE fi.fund_id = ?
          ORDER BY fi.status, u.name
        `,
        [id],
      );
      return {
        fund: shapeFund(r),
        assignments: a.map((x) => ({
          ...x,
          commitmentAmount: num(x.commitmentAmount),
          acceptedAt: iso(x.acceptedAt),
          createdAt: iso(x.createdAt)!,
        })) as AssignmentRow[],
      };
    },
    { refresh: false },
  );
}

// Only the fund manager can assign, so only the fund manager can list who is assignable: verified,
// active investors not already in the fund
export async function listAssignableInvestorsAction(input: z.input<typeof fundIdSchema>) {
  return runAction(
    async (): Promise<InvestorOption[]> => {
      const ctx = await authorize({ need: 'assignments:manage' });
      const { fundId } = fundIdSchema.parse(input);
      return rows<InvestorOption>(
        pool(),
        `
          SELECT u.id, u.name, u.email
          FROM users u
          JOIN investor_profiles p ON p.user_id = u.id
          WHERE u.org_id = ?
            AND u.role = 'investor'
            AND u.status = 'active'
            AND p.kyc_status = 'verified'
            AND NOT EXISTS (
              SELECT 1 FROM fund_investors fi
              WHERE fi.fund_id = ? AND fi.investor_id = u.id AND fi.status = 'active'
            )
          ORDER BY u.name
        `,
        [orgIdOf(ctx), fundId],
      );
    },
    { refresh: false },
  );
}

// The investor's own funds. Verified investors only, and draft funds are never shown to investors.
export async function listMyFundsAction() {
  return runAction(
    async (): Promise<MyFundRow[]> => {
      const ctx = await authorize({ roles: ['investor'], verifiedInvestor: true });
      const r = await rows(
        pool(),
        `
          SELECT fi.id AS assignmentId, f.id AS fundId, f.code, f.name, f.category, f.strategy,
              f.description, f.currency, f.tenure_years AS tenureYears, f.status,
              fi.commitment_amount AS commitmentAmount, fi.accepted_at AS acceptedAt
          FROM fund_investors fi
          JOIN funds f ON f.id = fi.fund_id
          WHERE fi.investor_id = ? AND fi.status = 'active' AND f.status <> 'draft'
          ORDER BY f.name
        `,
        [ctx.user.id],
      );
      return r.map((x) => ({
        ...x,
        tenureYears: num(x.tenureYears),
        commitmentAmount: num(x.commitmentAmount),
        acceptedAt: iso(x.acceptedAt),
      })) as MyFundRow[];
    },
    { refresh: false },
  );
}
