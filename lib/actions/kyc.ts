'use server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { authorize } from '@/lib/auth/authorize';
import { orgIdOf } from '@/lib/auth/core';
import { blindIndex, decrypt, encrypt } from '@/lib/crypto';
import { count, exec, one, pool, rows, tx } from '@/utils/db/mysqlPool';
import { AppError } from '@/lib/errors';
import { kycProvider } from '@/lib/kyc/provider';
import { computeAutoChecks, emptyFields, submissionProblems } from '@/lib/kyc/rules';
import { can } from '@/lib/rbac';
import { asJson, iso, newId, num, pageArgs, paged } from '@/lib/server-utils';
import type {
  AutoCheck,
  InvestorRow,
  Paged,
  KycDetail,
  KycDocKind,
  KycDocMeta,
  KycFields,
  KycStatus,
} from '@/utils/types';
import { runAction } from '@/lib/action-result';
import {
  documentIdSchema,
  investorIdSchema,
  investorListSchema,
  kycDraftSchema,
  kycSubmitSchema,
  reviewSchema,
} from '@/lib/validators/kyc';

const EDITABLE: KycStatus[] = ['not_started', 'in_progress', 'rejected'];
const MAX_DOC_BYTES = 3 * 1024 * 1024;
const KINDS = ['pan_card', 'address_proof', 'bank_proof', 'photo'] as const;
const toBool = (v: string) => (v === '' ? null : v === 'yes');
// What kind of file this really is, judged from its first bytes. The file name and the browser's
// claim are never trusted.
const sniff = (b: Buffer): string | null =>
  b.subarray(0, 4).toString('latin1') === '%PDF'
    ? 'application/pdf'
    : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
      ? 'image/jpeg'
      : b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
        ? 'image/png'
        : null;

// ---- turns a database row into the form shape, with or without the sensitive values. Used by the
// reads and by submit below. ----
const day = (d: unknown) => (d ? new Date(d as Date).toISOString().slice(0, 10) : '');
const yn = (v: unknown): '' | 'yes' | 'no' =>
  v === null || v === undefined ? '' : v ? 'yes' : 'no';

function toFields(p: Record<string, unknown>, full: boolean): KycFields {
  const f = emptyFields();
  f.legalName = (p.legal_name as string) ?? '';
  f.country = (p.country as string) ?? 'India';
  f.occupation = (p.occupation as string) ?? '';
  f.incomeRange = (p.income_range as string) ?? '';
  f.sourceOfFunds = (p.source_of_funds as string) ?? '';
  f.isPep = yn(p.is_pep);
  f.isUsPerson = yn(p.is_us_person);
  f.taxResidency = (p.tax_residency as string) ?? '';
  f.bankHolder = (p.bank_holder as string) ?? '';
  f.bankIfsc = (p.bank_ifsc as string) ?? '';
  f.bankName = (p.bank_name as string) ?? '';
  if (full) {
    f.dob = day(p.dob);
    f.mobile = (p.mobile as string) ?? '';
    f.aadhaarLast4 = (p.aadhaar_last4 as string) ?? '';
    f.addressLine1 = (p.address_line1 as string) ?? '';
    f.addressLine2 = (p.address_line2 as string) ?? '';
    f.city = (p.city as string) ?? '';
    f.state = (p.state as string) ?? '';
    f.pincode = (p.pincode as string) ?? '';
    f.panNumber = p.pan_enc ? decrypt(p.pan_enc as string) : '';
    f.bankAccountNumber = p.bank_account_enc ? decrypt(p.bank_account_enc as string) : '';
  } else {
    // Read-only roles (the auditor) see who and what, but not identity numbers or personal address
    // details
    f.panNumber = p.pan_last4 ? `XXXXXX${p.pan_last4}` : '';
    f.bankAccountNumber = p.bank_account_last4 ? `XXXXXX${p.bank_account_last4}` : '';
  }
  return f;
}

async function buildDetail(investorId: string, full: boolean): Promise<KycDetail | null> {
  const p = await one(
    pool(),
    `
      SELECT p.*, u.name, u.email, u.status AS user_status
      FROM investor_profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
    `,
    [investorId],
  );
  if (!p) return null;
  const docs = await rows(
    pool(),
    `
      SELECT id, kind, file_name AS fileName, mime, size_bytes AS sizeBytes,
          uploaded_at AS uploadedAt
      FROM kyc_documents
      WHERE user_id = ?
      ORDER BY kind
    `,
    [investorId],
  );
  const reviews = await rows(
    pool(),
    `
      SELECT r.id, u.name AS reviewerName, r.decision, r.reason, r.created_at AS createdAt
      FROM kyc_reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE r.investor_id = ?
      ORDER BY r.created_at DESC
    `,
    [investorId],
  );
  return {
    investorId,
    name: p.name,
    email: p.email,
    userStatus: p.user_status,
    status: p.kyc_status,
    fields: toFields(p, full),
    fullDetailsVisible: full,
    declarationAt: iso(p.declaration_at),
    submittedAt: iso(p.submitted_at),
    submissionCount: num(p.submission_count),
    rejectionReason: p.rejection_reason,
    documents: docs.map((d) => ({
      ...d,
      sizeBytes: num(d.sizeBytes),
      uploadedAt: iso(d.uploadedAt)!,
    })) as KycDocMeta[],
    checks: p.auto_checks ? asJson<AutoCheck[]>(p.auto_checks) : [],
    reviews: reviews.map((r) => ({ ...r, createdAt: iso(r.createdAt)! })) as KycDetail['reviews'],
  };
}

// ---- the investor's own KYC. These are the only actions an unverified investor may call. ----

export async function saveKycDraftAction(input: z.input<typeof kycDraftSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['investor'] });
    const f = kycDraftSchema.parse(input) as KycFields;
    await tx(async (c) => {
      const p = await one(
        c,
        'SELECT kyc_status, org_id FROM investor_profiles WHERE user_id = ? FOR UPDATE',
        [ctx.user.id],
      );
      if (!p) throw new AppError('Investor profile not found.', 'NOT_FOUND');
      if (!EDITABLE.includes(p.kyc_status))
        throw new AppError(
          'Your KYC is under review or already verified, so it cannot be edited.',
          'CONFLICT',
        );
      const pan = f.panNumber || null;
      const hash = pan ? blindIndex(pan) : null;
      if (
        hash &&
        (await one(
          c,
          'SELECT 1 AS x FROM investor_profiles WHERE org_id = ? AND pan_hash = ? AND user_id <> ?',
          [p.org_id, hash, ctx.user.id],
        ))
      ) {
        throw new AppError(
          'This PAN is already registered with another investor in this organization. Contact your fund manager.',
          'CONFLICT',
        );
      }
      await exec(
        c,
        `
          UPDATE investor_profiles
          SET legal_name=?, dob=?, mobile=?, pan_enc=?, pan_hash=?, pan_last4=?,
              aadhaar_last4=?, address_line1=?, address_line2=?, city=?, state=?, pincode=?,
              country=?, occupation=?, income_range=?, source_of_funds=?, is_pep=?,
              is_us_person=?, tax_residency=?, bank_holder=?, bank_account_enc=?,
              bank_account_last4=?, bank_ifsc=?, bank_name=?,
              kyc_status = IF(kyc_status = 'not_started', 'in_progress', kyc_status)
          WHERE user_id = ?
        `,
        [
          f.legalName || null,
          f.dob || null,
          f.mobile || null,
          pan && encrypt(pan),
          hash,
          pan && pan.slice(-4),
          f.aadhaarLast4 || null,
          f.addressLine1 || null,
          f.addressLine2 || null,
          f.city || null,
          f.state || null,
          f.pincode || null,
          f.country || 'India',
          f.occupation || null,
          f.incomeRange || null,
          f.sourceOfFunds || null,
          toBool(f.isPep),
          toBool(f.isUsPerson),
          f.taxResidency || null,
          f.bankHolder || null,
          f.bankAccountNumber ? encrypt(f.bankAccountNumber) : null,
          f.bankAccountNumber ? f.bankAccountNumber.slice(-4) : null,
          f.bankIfsc || null,
          f.bankName || null,
          ctx.user.id,
        ],
      );
      await audit(c, {
        orgId: p.org_id,
        actorId: ctx.user.id,
        action: 'kyc.save_draft',
        entity: 'investor',
        entityId: ctx.user.id,
        ip: ctx.ip,
      });
    });
  });
}

export async function uploadKycDocumentAction(form: FormData) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['investor'] });
    const kind = z.enum(KINDS).safeParse(form.get('kind'));
    const file = form.get('file');
    if (!kind.success || !(file instanceof File))
      throw new AppError('Choose a file to upload.', 'VALIDATION');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!bytes.length) throw new AppError('That file is empty.', 'VALIDATION');
    if (bytes.length > MAX_DOC_BYTES)
      throw new AppError('Files must be 3 MB or smaller.', 'VALIDATION');
    const mime = sniff(bytes);
    if (!mime) throw new AppError('Upload a PDF, JPG or PNG file.', 'VALIDATION');
    if (kind.data === 'photo' && mime === 'application/pdf')
      throw new AppError('The photograph must be a JPG or PNG image.', 'VALIDATION');
    const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document';
    return tx(async (c): Promise<KycDocMeta> => {
      const p = await one(
        c,
        'SELECT kyc_status, org_id FROM investor_profiles WHERE user_id = ? FOR UPDATE',
        [ctx.user.id],
      );
      if (!p) throw new AppError('Investor profile not found.', 'NOT_FOUND');
      if (!EDITABLE.includes(p.kyc_status))
        throw new AppError(
          'Your KYC is under review or already verified, so documents cannot be changed.',
          'CONFLICT',
        );
      await exec(c, 'DELETE FROM kyc_documents WHERE user_id = ? AND kind = ?', [
        ctx.user.id,
        kind.data,
      ]);
      const id = newId(),
        at = new Date();
      await exec(
        c,
        `
          INSERT INTO kyc_documents (id, user_id, org_id, kind, file_name, mime, size_bytes, sha256, content, uploaded_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
          id,
          ctx.user.id,
          p.org_id,
          kind.data,
          safeName,
          mime,
          bytes.length,
          crypto.createHash('sha256').update(bytes).digest('hex'),
          bytes,
          at,
        ],
      );
      await exec(
        c,
        `
          UPDATE investor_profiles
          SET kyc_status = IF(kyc_status = 'not_started', 'in_progress', kyc_status)
          WHERE user_id = ?
        `,
        [ctx.user.id],
      );
      await audit(c, {
        orgId: p.org_id,
        actorId: ctx.user.id,
        action: 'kyc.upload_document',
        entity: 'investor',
        entityId: ctx.user.id,
        after: { kind: kind.data, sizeBytes: bytes.length, mime },
        ip: ctx.ip,
      });
      return {
        id,
        kind: kind.data as KycDocKind,
        fileName: safeName,
        mime,
        sizeBytes: bytes.length,
        uploadedAt: at.toISOString(),
      };
    });
  });
}

export async function submitKycAction(input: z.input<typeof kycSubmitSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ roles: ['investor'] });
    // the declaration must be ticked
    kycSubmitSchema.parse(input);
    await tx(async (c) => {
      const p = await one(c, 'SELECT * FROM investor_profiles WHERE user_id = ? FOR UPDATE', [
        ctx.user.id,
      ]);
      if (!p) throw new AppError('Investor profile not found.', 'NOT_FOUND');
      if (!EDITABLE.includes(p.kyc_status))
        throw new AppError('Your KYC has already been submitted.', 'CONFLICT');
      const fields = toFields(p, true);
      const kinds = (
        await rows<{ kind: string }>(c, 'SELECT kind FROM kyc_documents WHERE user_id = ?', [
          ctx.user.id,
        ])
      ).map((d) => d.kind);
      const problems = submissionProblems(fields, kinds);
      if (problems.length)
        throw new AppError(`Fix these before submitting: ${problems.join('; ')}.`, 'VALIDATION');
      const dup = !!(await one(
        c,
        'SELECT 1 AS x FROM investor_profiles WHERE org_id = ? AND pan_hash = ? AND user_id <> ?',
        [p.org_id, p.pan_hash, ctx.user.id],
      ));
      if (dup)
        throw new AppError(
          'This PAN is already registered with another investor in this organization.',
          'CONFLICT',
        );
      const checks = [
        ...computeAutoChecks(fields, { duplicatePan: dup }),
        ...(await kycProvider.verify(fields)),
      ];
      await exec(
        c,
        `
          UPDATE investor_profiles
          SET kyc_status='submitted', submitted_at=?, declaration_at=?, auto_checks=?,
              submission_count=submission_count+1, rejection_reason=NULL, reviewed_by=NULL,
              reviewed_at=NULL
          WHERE user_id=?
        `,
        [new Date(), new Date(), JSON.stringify(checks), ctx.user.id],
      );
      await audit(c, {
        orgId: p.org_id,
        actorId: ctx.user.id,
        action: 'kyc.submit',
        entity: 'investor',
        entityId: ctx.user.id,
        after: { submission: num(p.submission_count) + 1 },
        ip: ctx.ip,
      });
    });
  });
}

// ---- reviewers: fund manager and compliance manager (kyc:review) ----
export async function reviewKycAction(input: z.input<typeof reviewSchema>) {
  return runAction(async () => {
    const ctx = await authorize({ need: 'kyc:review' });
    const b = reviewSchema.parse(input);
    const orgId = orgIdOf(ctx);
    await tx(async (c) => {
      const p = await one(
        c,
        `
          SELECT p.kyc_status, p.org_id
          FROM investor_profiles p
          JOIN users u ON u.id = p.user_id
          WHERE p.user_id = ? AND u.role = 'investor'
          FOR UPDATE
        `,
        [b.investorId],
      );
      if (!p || p.org_id !== orgId) throw new AppError('Investor not found.', 'NOT_FOUND');
      if (p.kyc_status !== 'submitted')
        throw new AppError('Only submitted applications can be reviewed.', 'CONFLICT');
      const now = new Date();
      await exec(
        c,
        `
          INSERT INTO kyc_reviews (id, investor_id, org_id, reviewer_id, decision, reason, checklist, created_at)
          VALUES (?,?,?,?,?,?,?,?)
        `,
        [
          newId(),
          b.investorId,
          orgId,
          ctx.user.id,
          b.decision,
          b.reason ?? null,
          JSON.stringify(b.checklist),
          now,
        ],
      );
      await exec(
        c,
        `
          UPDATE investor_profiles
          SET kyc_status = ?, reviewed_by = ?, reviewed_at = ?, rejection_reason = ?
          WHERE user_id = ?
        `,
        [b.decision, ctx.user.id, now, b.decision === 'rejected' ? b.reason! : null, b.investorId],
      );
      await audit(c, {
        orgId,
        actorId: ctx.user.id,
        action: `kyc.${b.decision === 'verified' ? 'verify' : 'reject'}`,
        entity: 'investor',
        entityId: b.investorId,
        after: { decision: b.decision, reason: b.reason ?? null },
        ip: ctx.ip,
      });
    });
  });
}

// Documents are served through an action so the check runs on every open. Anyone other than the
// owner leaves an audit entry.
export async function getKycDocumentAction(input: z.input<typeof documentIdSchema>) {
  return runAction(
    async () => {
      const ctx = await authorize();
      const b = documentIdSchema.parse(input);
      const d = await one(
        pool(),
        `
          SELECT id, user_id, org_id, kind, file_name, mime, content
          FROM kyc_documents
          WHERE id = ?
        `,
        [b.documentId],
      );
      const own = d && ctx.user.role === 'investor' && d.user_id === ctx.user.id;
      const reviewer =
        d &&
        ctx.user.role !== 'investor' &&
        ctx.user.orgId === d.org_id &&
        can(ctx.user.role, 'kyc:documents');
      if (!d || !(own || reviewer)) throw new AppError('Document not found.', 'NOT_FOUND');
      if (!own)
        await tx(async (c) =>
          audit(c, {
            orgId: d.org_id,
            actorId: ctx.user.id,
            action: 'kyc.view_document',
            entity: 'investor',
            entityId: d.user_id,
            after: { kind: d.kind },
            ip: ctx.ip,
          }),
        );
      return {
        fileName: d.file_name as string,
        mime: d.mime as string,
        base64: (d.content as Buffer).toString('base64'),
      };
    },
    { refresh: false },
  );
}

// ---- shared reads. One action serves every role that may look, and `need` / the checks inside
// decide who gets what. ----

// The investor's own application (their own panel and the KYC page). Works before KYC is verified:
// it is how they fill it in.
export async function getOwnKycAction() {
  return runAction(
    async () => {
      const ctx = await authorize({ roles: ['investor'] });
      const d = await buildDetail(ctx.user.id, true);
      if (!d) throw new AppError('Investor profile not found.', 'NOT_FOUND');
      return d;
    },
    { refresh: false },
  );
}

// Org admin, fund manager and compliance manager see everything; the auditor gets a masked view (no
// kyc:documents).
export async function getInvestorKycAction(input: z.input<typeof investorIdSchema>) {
  return runAction(
    async () => {
      const ctx = await authorize({ need: 'kyc:view' });
      const { investorId } = investorIdSchema.parse(input);
      const owner = await one<{ org_id: string }>(
        pool(),
        `SELECT org_id FROM users WHERE id = ? AND role = 'investor'`,
        [investorId],
      );
      if (!owner || owner.org_id !== orgIdOf(ctx))
        // another organization's investor looks like it does not exist
        throw new AppError('Investor not found.', 'NOT_FOUND');
      const d = await buildDetail(investorId, can(ctx.user.role, 'kyc:documents'));
      if (!d) throw new AppError('Investor not found.', 'NOT_FOUND');
      return d;
    },
    { refresh: false },
  );
}

// Investors with their KYC status. Applications waiting for review come first.
export async function listInvestorsAction(input: z.input<typeof investorListSchema> = {}) {
  return runAction(
    async (): Promise<Paged<InvestorRow>> => {
      const ctx = await authorize({ need: 'investors:view' });
      const { status, ...q } = investorListSchema.parse(input);
      const pg = pageArgs(q);
      const where = `
        u.org_id = ?
        AND u.role = 'investor'
        AND (? IS NULL OR p.kyc_status = ?)
        AND (? = '' OR u.name LIKE ? OR u.email LIKE ?)
      `;
      const args = [orgIdOf(ctx), status ?? null, status ?? null, pg.search, pg.like, pg.like];
      const total = await count(
        pool(),
        `
              SELECT COUNT(*) AS n
              FROM users u
              JOIN investor_profiles p ON p.user_id = u.id
              WHERE ${where}
            `,
        args,
      );
      const r = await rows(
        pool(),
        `
          SELECT
            u.id, u.name, u.email, u.status AS userStatus,
            p.kyc_status AS kycStatus, p.submitted_at AS submittedAt, u.created_at AS createdAt,
            (SELECT COUNT(*)
               FROM fund_investors fi
               WHERE fi.investor_id = u.id AND fi.status = 'active') AS fundCount,
            (SELECT COALESCE(SUM(fi.commitment_amount), 0)
               FROM fund_investors fi
               WHERE fi.investor_id = u.id AND fi.status = 'active') AS committed
          FROM users u
          JOIN investor_profiles p ON p.user_id = u.id
          WHERE ${where}
          ORDER BY (p.kyc_status = 'submitted') DESC, p.submitted_at, u.name
          LIMIT ? OFFSET ?
        `,
        [...args, pg.limit, pg.offset],
      );
      return paged(
        r.map((x) => ({
          ...x,
          submittedAt: iso(x.submittedAt),
          createdAt: iso(x.createdAt)!,
          fundCount: num(x.fundCount),
          committed: num(x.committed),
        })) as InvestorRow[],
        total,
        pg.page,
        pg.limit,
      );
    },
    { refresh: false },
  );
}
