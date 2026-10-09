import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { after, before, describe, test } from 'node:test';
import { decodeJwt, SignJWT } from 'jose';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'mysql://aif:aif@localhost:3306/aif_platform';
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

/* eslint-disable @typescript-eslint/no-explicit-any */
// These tests call the REAL Server Actions in-process. Only Next's request plumbing is replaced: a
// cookie jar stands in for the browser's cookies and the request headers, so every action runs its
// own session check exactly as it does in production.
const jar = new Map<string, string>();
const reqHeaders: Record<string, string> = { 'x-forwarded-for': '10.0.0.1' };
const stubs: Record<string, unknown> = {
  'server-only': {},
  'next/cache': { revalidatePath() {} },
  'next/headers': {
    cookies: async () => ({
      get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n) } : undefined),
      set: (n: string, v: string) => {
        jar.set(n, v);
      },
      delete: (n: string) => {
        jar.delete(n);
      },
    }),
    headers: async () => ({ get: (n: string) => reqHeaders[n.toLowerCase()] ?? null }),
  },
};
const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...rest: unknown[]) {
  return request in stubs ? stubs[request] : originalLoad.call(this, request, ...rest);
};

let A: any = {},
  M: any = {};
const PW = 'A-long-password-2026',
  SYS = 'sys@platform.test';
const sent: { email: string; code: string }[] = [];
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const good = (over: Record<string, string> = {}) => ({
  legalName: 'Anita Rao',
  dob: '1988-04-12',
  mobile: '9876543210',
  panNumber: 'ABCPR1234K',
  aadhaarLast4: '4321',
  addressLine1: '12 MG Road',
  addressLine2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  country: 'India',
  occupation: 'Salaried',
  incomeRange: '₹25 lakh-1 crore',
  sourceOfFunds: 'Salary',
  isPep: 'no',
  isUsPerson: 'no',
  taxResidency: 'India',
  bankHolder: 'Anita Rao',
  bankAccountNumber: '123456789012',
  bankIfsc: 'HDFC0001234',
  bankName: 'HDFC Bank',
  ...over,
});

type Who = { id: string; name: string; email: string; role: string; token: string; ctx: any };
const fail = (r: any) => Object.assign(new Error(r.error), { code: r.code });
const rej = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: any) => e.code === code, `expected ${code}`);
const lastCode = (email: string) => [...sent].reverse().find((m) => m.email === email)!.code;
const wrongFor = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

// call an action as a person (null = signed out) and unwrap the result like the browser would see
// it
async function call<T = any>(
  who: { token: string } | null,
  action: (i?: any) => Promise<any>,
  input?: any,
  ip = '10.0.0.1',
): Promise<T> {
  jar.clear();
  if (who) jar.set('aif_session', who.token);
  reqHeaders['x-forwarded-for'] = ip;
  const r = await action(input);
  if (!r.ok) throw fail(r);
  return r.data;
}
const begin = async (email: string, password = PW, ip = '10.0.0.1') => {
  // step 1 as the browser does it; returns the OTP cookie
  jar.clear();
  reqHeaders['x-forwarded-for'] = ip;
  const r = await (email === SYS ? A.systemLoginAction : A.loginAction)({ email, password });
  return { r, otp: jar.get('aif_otp') as string };
};
const verify = async (otp: string | undefined, code: string, ip = '10.0.0.1') => {
  // step 2
  jar.clear();
  if (otp) jar.set('aif_otp', otp);
  reqHeaders['x-forwarded-for'] = ip;
  return A.verifyOtpAction({ code });
};
async function signIn(email: string, password = PW, ip = '10.0.0.1'): Promise<Who> {
  const { r, otp } = await begin(email, password, ip);
  if (!r.ok) throw fail(r);
  const v = await verify(otp, lastCode(email), ip);
  if (!v.ok) throw fail(v);
  const token = jar.get('aif_session')!,
    ctx = await M.core.authenticateToken(token, ip);
  return { id: ctx.user.id, name: ctx.user.name, email, role: ctx.user.role, token, ctx };
}
async function person(by: Who, name: string, email: string, role: string, orgId?: string) {
  // create through the real action, accept the invite, sign in
  const u = await call(by, A.createUserAction, { name, email, role, orgId });
  await call(null, A.acceptInviteAction, { token: u.inviteToken, password: PW });
  return signIn(email);
}
const upload = (who: Who, kind: string, name: string, bytes: Buffer) => {
  const fd = new FormData();
  fd.set('kind', kind);
  fd.set('file', new File([bytes], name));
  return call(who, A.uploadKycDocumentAction, fd);
};

before(async () => {
  const load = async (files: string[]) =>
    Object.assign({}, ...(await Promise.all(files.map((f) => import(f)))));
  A = await load([
    '../lib/actions/auth',
    '../lib/actions/organizations',
    '../lib/actions/users',
    '../lib/actions/funds',
    '../lib/actions/kyc',
    '../lib/actions/audit',
    '../lib/actions/stats',
  ]);
  const [db, core, jwt, rbac, rules, notify, mig, seed] = await Promise.all([
    import('../utils/db/mysqlPool'),
    import('../lib/auth/core'),
    import('../lib/auth/jwt'),
    import('../lib/rbac'),
    import('../lib/kyc/rules'),
    import('../lib/notify'),
    import('../scripts/migrate'),
    import('../scripts/seed'),
  ]);
  M = { db, core, jwt, rbac, rules, notify };
  notify.setOtpSender(async (m: any) => {
    sent.push({ email: m.email, code: m.code });
    // capture what would have been emailed
  });
  await mig.migrate(process.env.DATABASE_URL);
  const p = db.pool();
  await p.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of [
    'login_challenges',
    'login_failures',
    'audit_log',
    'kyc_reviews',
    'kyc_documents',
    'fund_investors',
    'funds',
    'investor_profiles',
    'invites',
    'users',
    'organizations',
  ])
    await p.query(`TRUNCATE TABLE ${t}`);
  await p.query('SET FOREIGN_KEY_CHECKS = 1');
  await p.query("UPDATE audit_head SET last_hash = '' WHERE id = 1");
  await seed.seed({ adminEmail: SYS, adminPassword: 'SystemPassword!2026' });
});
after(async () => {
  await M.db.pool().end();
});

describe('AIF platform: hierarchy, roles and KYC (through the real Server Actions)', () => {
  let sys: Who,
    adminA: Who,
    adminB: Who,
    manager: Who,
    compliance: Who,
    auditor: Who,
    inv1: Who,
    inv2: Who,
    orgA = '',
    orgB = '',
    fundId = '';

  test('system admin creates organizations; each gets its own org admin', async () => {
    sys = await signIn(SYS, 'SystemPassword!2026');
    assert.equal(sys.role, 'system_admin');
    assert.equal(sys.ctx.org, null);
    const mk = async (name: string, adminEmail: string) => {
      const o = await call(sys, A.createOrgAction, {
        name,
        adminName: 'Admin ' + name,
        adminEmail,
      });
      await call(null, A.acceptInviteAction, { token: o.inviteToken, password: PW });
      return o.id as string;
    };
    orgA = await mk('Crestline Capital', 'admin@crestline.test');
    orgB = await mk('Meridian Funds', 'admin@meridian.test');
    adminA = await signIn('admin@crestline.test');
    adminB = await signIn('admin@meridian.test');
    assert.equal(adminA.role, 'org_admin');
    assert.equal(adminA.ctx.org.name, 'Crestline Capital');
    await rej(
      call(sys, A.createOrgAction, {
        name: 'crestline capital',
        adminName: 'X Y',
        adminEmail: 'x@y.test',
      }),
      'CONFLICT',
      // names are unique, case-insensitive
    );
    await rej(
      call(sys, A.createOrgAction, {
        name: 'Another',
        adminName: 'X Y',
        adminEmail: 'admin@crestline.test',
      }),
      'CONFLICT',
      // so are emails
    );
    await rej(
      call(adminA, A.createOrgAction, { name: 'Rogue', adminName: 'X Y', adminEmail: 'r@y.test' }),
      'FORBIDDEN',
      // only the system admin creates organizations
    );
  });

  test('role and permission matrix matches the brief', () => {
    const { can, CREATABLE_ROLES } = M.rbac;
    assert.ok(
      !can('org_admin', 'funds:create') && !can('org_admin', 'funds:edit'),
      'org admin cannot create funds',
    );
    for (const p of [
      'funds:view',
      'assignments:view',
      'investors:view',
      'kyc:view',
      'kyc:documents',
      'users:create',
      'audit:view',
    ])
      assert.ok(can('org_admin', p), `org admin ${p}`);
    assert.ok(
      can('fund_manager', 'funds:create') &&
        can('fund_manager', 'assignments:manage') &&
        can('fund_manager', 'kyc:review'),
    );
    assert.ok(
      can('compliance_manager', 'kyc:review') && !can('compliance_manager', 'funds:create'),
    );
    assert.ok(
      !can('auditor', 'kyc:review') &&
        !can('auditor', 'kyc:documents') &&
        !can('auditor', 'funds:create'),
    );
    assert.deepEqual(
      CREATABLE_ROLES.fund_manager,
      ['investor'],
      'fund managers create investors and nothing else',
    );
    assert.deepEqual([...CREATABLE_ROLES.org_admin].sort(), [
      'auditor',
      'compliance_manager',
      'fund_manager',
      'investor',
      'org_admin',
    ]);
    assert.deepEqual(CREATABLE_ROLES.system_admin, ['org_admin']);
    for (const r of ['compliance_manager', 'auditor', 'investor'])
      assert.deepEqual(CREATABLE_ROLES[r], []);
    assert.ok(
      can('org_admin', 'organizations:profile'),
      "an org admin sets their own organization's type",
    );
    for (const r of ['system_admin', 'fund_manager', 'compliance_manager', 'auditor', 'investor'])
      assert.ok(!can(r, 'organizations:profile'), `${r} cannot set an organization's type`);
    assert.equal(M.rbac.PERMISSIONS.investor.length, 0);
  });

  test('org admin creates every kind of user (including fund managers); fund manager creates only investors', async () => {
    manager = await person(adminA, 'Farah Manager', 'farah@crestline.test', 'fund_manager');
    compliance = await person(
      adminA,
      'Chitra Compliance',
      'chitra@crestline.test',
      'compliance_manager',
    );
    auditor = await person(adminA, 'Arjun Auditor', 'arjun@crestline.test', 'auditor');
    inv1 = await person(adminA, 'Anita Rao', 'anita@crestline.test', 'investor');
    await person(adminA, 'Second Admin', 'admin2@crestline.test', 'org_admin');
    inv2 = await person(manager, 'Bharat Shah', 'bharat@crestline.test', 'investor');
    for (const r of ['org_admin', 'fund_manager', 'compliance_manager', 'auditor'])
      await rej(
        call(manager, A.createUserAction, { name: 'No Way', email: `${r}@x.test`, role: r }),
        'FORBIDDEN',
      );
    for (const who of [compliance, auditor, inv1])
      await rej(
        call(who, A.createUserAction, { name: 'No Way', email: 'nw@x.test', role: 'investor' }),
        'FORBIDDEN',
      );
    await rej(
      call(sys, A.createUserAction, {
        name: 'No Way',
        email: 'nw2@x.test',
        role: 'investor',
        orgId: orgA,
      }),
      'FORBIDDEN',
      // the system admin only creates org admins
    );
    const x = await call(adminA, A.createUserAction, {
      name: 'Stay Here',
      email: 'stay@crestline.test',
      role: 'auditor',
      orgId: orgB,
      // asking for another organization is ignored
    });
    assert.equal(
      (await call(adminB, A.listUsersAction)).rows.some((u: any) => u.id === x.id),
      false,
    );
    assert.equal(
      (await call(adminA, A.listUsersAction)).rows.some((u: any) => u.id === x.id),
      true,
    );
  });

  test('organizations are isolated; the system admin never touches funds or investors', async () => {
    const a = (await call(adminA, A.listUsersAction)).rows,
      b = (await call(adminB, A.listUsersAction)).rows;
    assert.ok(a.every((u: any) => u.email.endsWith('crestline.test')));
    assert.ok(b.every((u: any) => u.email.endsWith('meridian.test')));
    await rej(
      call(adminB, A.setUserStatusAction, { userId: inv1.id, status: 'suspended' }),
      'NOT_FOUND',
    );
    await rej(call(adminB, A.getInvestorKycAction, { investorId: inv1.id }), 'NOT_FOUND');
    await rej(call(sys, A.listFundsAction), 'FORBIDDEN');
    await rej(call(sys, A.listInvestorsAction), 'FORBIDDEN');
    assert.equal((await call(adminA, A.listOrgsAction)).length, 1);
    assert.equal((await call(sys, A.listOrgsAction)).length, 2);
  });

  test('only the fund manager creates and maintains funds', async () => {
    const f = {
      code: 'cgf-1',
      name: 'Crestline Growth Fund I',
      category: 'Category II',
      targetSize: 500_000_000,
      minCommitment: 10_000_000,
      tenureYears: 8,
    };
    for (const who of [adminA, compliance, auditor, inv1])
      await rej(call(who, A.createFundAction, f), 'FORBIDDEN');
    fundId = (await call(manager, A.createFundAction, f)).id;
    await rej(call(manager, A.createFundAction, f), 'CONFLICT');
    await rej(
      call(manager, A.createFundAction, { ...f, code: 'BAD-1', minCommitment: 9e9 }),
      'VALIDATION',
    );
    // the org admin can see it...
    assert.equal((await call(adminA, A.listFundsAction)).rows.length, 1);
    // ...other organizations cannot
    assert.equal((await call(adminB, A.listFundsAction)).rows.length, 0);
    await rej(
      call(adminA, A.updateFundAction, { ...f, id: fundId, code: 'CGF-1', name: 'Hacked' }),
      'FORBIDDEN',
      // ...but the org admin cannot change it
    );
    await call(manager, A.updateFundAction, {
      ...f,
      id: fundId,
      code: 'CGF-1',
      name: 'Crestline Growth Fund I (renamed)',
      targetSize: 600_000_000,
    });
    // draft cannot jump to closed
    await rej(call(manager, A.setFundStatusAction, { id: fundId, status: 'closed' }), 'CONFLICT');
    await call(manager, A.setFundStatusAction, { id: fundId, status: 'open' });
  });

  test('an investor without verified KYC cannot be given a commitment', async () => {
    await rej(
      call(manager, A.assignInvestorAction, {
        fundId,
        investorId: inv1.id,
        commitmentAmount: 20_000_000,
      }),
      'KYC_REQUIRED',
    );
  });

  test('KYC: drafts are validated, files are checked by content, PAN and bank details are encrypted', async () => {
    // nothing filled in
    await rej(call(inv1, A.submitKycAction, { declaration: true }), 'VALIDATION');
    // declaration not ticked
    await rej(call(inv1, A.submitKycAction, { declaration: false }), 'VALIDATION');
    await rej(call(inv1, A.saveKycDraftAction, good({ panNumber: '12345' })), 'VALIDATION');
    await call(inv1, A.saveKycDraftAction, good());
    // not a real PDF/JPG/PNG
    await rej(upload(inv1, 'pan_card', 'x.pdf', Buffer.from('this is plainly text')), 'VALIDATION');
    // the photo must be an image
    await rej(upload(inv1, 'photo', 'x.pdf', PDF), 'VALIDATION');
    await rej(
      upload(inv1, 'pan_card', 'big.pdf', Buffer.concat([PDF, Buffer.alloc(3.1 * 1024 * 1024)])),
      'VALIDATION',
    );
    await upload(inv1, 'pan_card', '../../evil name.pdf', PDF);
    const row = await M.db.one(
      M.db.pool(),
      'SELECT pan_enc, bank_account_enc, pan_last4, bank_account_last4, kyc_status FROM investor_profiles WHERE user_id = ?',
      [inv1.id],
    );
    assert.ok(
      !row.pan_enc.includes('ABCPR1234K') && !row.bank_account_enc.includes('123456789012'),
      'stored encrypted',
    );
    assert.equal(row.pan_last4, '234K');
    assert.equal(row.kyc_status, 'in_progress');
    const mine = await call(inv1, A.getOwnKycAction);
    // the owner can read it back
    assert.equal(mine.fields.panNumber, 'ABCPR1234K');
    // the file name is sanitized
    assert.ok(!/[\\/]/.test(mine.documents[0].fileName));
    // documents still missing
    await rej(call(inv1, A.submitKycAction, { declaration: true }), 'VALIDATION');
    // only investors fill in KYC
    await rej(call(manager, A.saveKycDraftAction, good()), 'FORBIDDEN');
  });

  test("KYC: an investor cannot reuse another investor's PAN, and under-18s are refused", async () => {
    await rej(
      call(
        inv2,
        A.saveKycDraftAction,
        good({ legalName: 'Bharat Shah', bankHolder: 'Bharat Shah' }),
      ),
      'CONFLICT',
      // same PAN as Anita
    );
    await call(
      inv2,
      A.saveKycDraftAction,
      good({
        legalName: 'Bharat Shah',
        bankHolder: 'Bharat Shah',
        panNumber: 'BCDPS2345L',
        dob: '2015-01-01',
      }),
    );
    for (const k of ['pan_card', 'address_proof', 'bank_proof'])
      await upload(inv2, k, `${k}.pdf`, PDF);
    await upload(inv2, 'photo', 'me.jpg', JPG);
    await assert.rejects(
      call(inv2, A.submitKycAction, { declaration: true }),
      (e: any) => e.code === 'VALIDATION' && /18 years/.test(e.message),
    );
    assert.equal(M.rules.ageOn('2000-06-15', new Date('2026-06-14T00:00:00Z')), 25);
    assert.ok(M.rules.nameSimilarity('Anita Rao', 'RAO ANITA K') >= 0.99);
    assert.ok(M.rules.nameSimilarity('Anita Rao', 'Somebody Else') < 0.5);
  });

  test('KYC: submit, then reviewers verify or reject; the investor is locked while under review', async () => {
    for (const k of ['address_proof', 'bank_proof']) await upload(inv1, k, `${k}.pdf`, PDF);
    await upload(
      inv1,
      'photo',
      'me.png',
      Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(40)]),
    );
    await call(inv1, A.submitKycAction, { declaration: true });
    assert.equal((await call(inv1, A.getOwnKycAction)).status, 'submitted');
    // locked while under review
    await rej(call(inv1, A.saveKycDraftAction, good()), 'CONFLICT');
    await rej(upload(inv1, 'photo', 'again.jpg', JPG), 'CONFLICT');
    await rej(call(inv1, A.submitKycAction, { declaration: true }), 'CONFLICT');
    const detail = await call(manager, A.getInvestorKycAction, { investorId: inv1.id });
    assert.equal(detail.checks.find((c: any) => c.key === 'name_match').status, 'pass');
    assert.ok(
      detail.checks.some((c: any) => c.key === 'provider_pan' && c.status === 'skipped'),
      'no provider is honestly reported as skipped',
    );
    assert.equal(
      (await call(compliance, A.listInvestorsAction, { status: 'submitted' })).rows.length,
      1,
    );

    const all = {
      identityMatches: true,
      addressValid: true,
      bankValid: true,
      photoClear: true,
      sanctionsScreened: true,
    };
    await rej(
      call(adminA, A.reviewKycAction, {
        investorId: inv1.id,
        decision: 'verified',
        checklist: all,
      }),
      'FORBIDDEN',
      // org admin cannot review
    );
    await rej(
      call(auditor, A.reviewKycAction, {
        investorId: inv1.id,
        decision: 'verified',
        checklist: all,
      }),
      'FORBIDDEN',
      // nor can the auditor
    );
    await rej(
      call(compliance, A.reviewKycAction, {
        investorId: inv1.id,
        decision: 'verified',
        checklist: { ...all, bankValid: false },
      }),
      'VALIDATION',
    );
    await rej(
      call(compliance, A.reviewKycAction, {
        investorId: inv1.id,
        decision: 'rejected',
        reason: 'bad',
        checklist: all,
      }),
      'VALIDATION',
    );
    await call(compliance, A.reviewKycAction, {
      investorId: inv1.id,
      decision: 'rejected',
      reason: 'Bank proof is blurry, please re-upload',
      checklist: { ...all, bankValid: false },
    });
    const rejected = await call(inv1, A.getOwnKycAction);
    assert.equal(rejected.status, 'rejected');
    assert.match(rejected.rejectionReason, /blurry/);
    await rej(
      call(compliance, A.reviewKycAction, {
        investorId: inv1.id,
        decision: 'verified',
        checklist: all,
      }),
      'CONFLICT',
      // nothing to review now
    );
    // editable again after a rejection
    await upload(inv1, 'bank_proof', 'clear.pdf', PDF);
    await call(inv1, A.submitKycAction, { declaration: true });
    assert.equal((await call(inv1, A.getOwnKycAction)).submissionCount, 2);
    await call(manager, A.reviewKycAction, {
      investorId: inv1.id,
      decision: 'verified',
      checklist: all,
      // the fund manager can verify too
    });
    const done = await call(inv1, A.getOwnKycAction);
    assert.equal(done.status, 'verified');
    assert.equal(done.reviews.length, 2, 'history is kept');
    // verified details are locked
    await rej(call(inv1, A.saveKycDraftAction, good()), 'CONFLICT');
  });

  test('KYC data visibility depends on the role, and document access is audited', async () => {
    const full = await call(adminA, A.getInvestorKycAction, { investorId: inv1.id }),
      masked = await call(auditor, A.getInvestorKycAction, { investorId: inv1.id });
    assert.equal(full.fields.panNumber, 'ABCPR1234K');
    assert.equal(full.fullDetailsVisible, true);
    assert.equal(masked.fullDetailsVisible, false);
    assert.equal(masked.fields.panNumber, 'XXXXXX234K');
    assert.equal(masked.fields.bankAccountNumber, 'XXXXXX9012');
    assert.equal(masked.fields.dob, '');
    const doc = full.documents[0].id;
    const views = async () =>
      Number(
        (
          await M.db.one(
            M.db.pool(),
            `SELECT COUNT(*) n FROM audit_log WHERE action = 'kyc.view_document'`,
          )
        ).n,
      );
    const before = await views();
    const got = await call(compliance, A.getKycDocumentAction, { documentId: doc });
    assert.equal(got.mime, 'application/pdf');
    assert.equal(Buffer.from(got.base64, 'base64').subarray(0, 4).toString(), '%PDF');
    assert.equal(await views(), before + 1);
    // the owner can, without an audit entry
    await call(inv1, A.getKycDocumentAction, { documentId: doc });
    assert.equal(await views(), before + 1);
    // auditors cannot open documents
    await rej(call(auditor, A.getKycDocumentAction, { documentId: doc }), 'NOT_FOUND');
    // other investors cannot
    await rej(call(inv2, A.getKycDocumentAction, { documentId: doc }), 'NOT_FOUND');
    // other organizations cannot
    await rej(call(adminB, A.getKycDocumentAction, { documentId: doc }), 'NOT_FOUND');
    await rej(call(null, A.getKycDocumentAction, { documentId: doc }), 'UNAUTHENTICATED');
  });

  test('verified investors are assigned to funds and maintained by the fund manager', async () => {
    const a = await call(manager, A.assignInvestorAction, {
      fundId,
      investorId: inv1.id,
      commitmentAmount: 20_000_000,
      notes: 'Anchor',
    });
    await rej(
      call(manager, A.assignInvestorAction, {
        fundId,
        investorId: inv1.id,
        commitmentAmount: 20_000_000,
      }),
      'CONFLICT',
    );
    await rej(
      call(manager, A.assignInvestorAction, {
        fundId,
        investorId: inv2.id,
        commitmentAmount: 20_000_000,
      }),
      'KYC_REQUIRED',
      // inv2 is not verified
    );
    await rej(
      call(adminA, A.assignInvestorAction, {
        fundId,
        investorId: inv1.id,
        commitmentAmount: 20_000_000,
      }),
      'FORBIDDEN',
      // the org admin cannot assign
    );
    assert.equal((await call(manager, A.listAssignableInvestorsAction, { fundId })).length, 0);
    await rej(
      call(manager, A.updateAssignmentAction, { assignmentId: a.id, commitmentAmount: 5_000_000 }),
      'VALIDATION',
      // below the minimum
    );
    await rej(
      call(manager, A.updateAssignmentAction, {
        assignmentId: a.id,
        commitmentAmount: 700_000_000,
      }),
      'CONFLICT',
      // above the target
    );
    const mine = await call(inv1, A.listMyFundsAction);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].commitmentAmount, 20_000_000);
    await call(inv1, A.acceptCommitmentAction, { assignmentId: a.id });
    await rej(call(inv1, A.acceptCommitmentAction, { assignmentId: a.id }), 'CONFLICT');
    // unverified investors cannot confirm anything
    await rej(call(inv2, A.acceptCommitmentAction, { assignmentId: a.id }), 'KYC_REQUIRED');
    await rej(call(manager, A.acceptCommitmentAction, { assignmentId: a.id }), 'FORBIDDEN');
    await call(manager, A.updateAssignmentAction, {
      assignmentId: a.id,
      commitmentAmount: 25_000_000,
      // changing the amount asks the investor to confirm again
    });
    assert.equal((await call(inv1, A.listMyFundsAction))[0].acceptedAt, null);
    await call(manager, A.removeAssignmentAction, { assignmentId: a.id });
    assert.equal((await call(inv1, A.listMyFundsAction)).length, 0);
    await call(manager, A.assignInvestorAction, {
      fundId,
      investorId: inv1.id,
      commitmentAmount: 30_000_000,
      // can be assigned again
    });
    // the org admin sees everything
    const d = await call(adminA, A.getFundAction, { id: fundId });
    assert.equal(d.fund.committed, 30_000_000);
    assert.equal(d.assignments.filter((x: any) => x.status === 'active').length, 1);
    await rej(call(adminB, A.getFundAction, { id: fundId }), 'NOT_FOUND');
  });

  test('draft funds stay hidden from investors', async () => {
    const id = (
      await call(manager, A.createFundAction, {
        code: 'DRAFT-1',
        name: 'Hidden draft',
        category: 'Category I',
        targetSize: 1e8,
        minCommitment: 1e6,
        tenureYears: 5,
      })
    ).id;
    await call(manager, A.assignInvestorAction, {
      fundId: id,
      investorId: inv1.id,
      commitmentAmount: 2_000_000,
    });
    assert.ok(!(await call(inv1, A.listMyFundsAction)).some((f: any) => f.fundId === id));
  });

  test('user management: scope, self-protection and the last org admin', async () => {
    await call(adminA, A.setUserStatusAction, { userId: auditor.id, status: 'suspended' });
    await rej(
      call(null, A.loginAction, { email: 'arjun@crestline.test', password: PW }),
      'UNAUTHENTICATED',
      // a suspended person cannot even start signing in
    );
    await call(adminA, A.setUserStatusAction, { userId: auditor.id, status: 'active' });
    await rej(
      call(adminA, A.setUserStatusAction, { userId: adminA.id, status: 'suspended' }),
      'CONFLICT',
    );
    await rej(
      call(manager, A.setUserStatusAction, { userId: adminA.id, status: 'suspended' }),
      'FORBIDDEN',
      // a fund manager cannot manage org admins
    );
    await rej(
      call(manager, A.setUserStatusAction, { userId: auditor.id, status: 'suspended' }),
      'FORBIDDEN',
    );
    // but can manage investors
    await call(manager, A.setUserStatusAction, { userId: inv2.id, status: 'suspended' });
    await call(manager, A.setUserStatusAction, { userId: inv2.id, status: 'active' });
    const sole = (await call(sys, A.listUsersAction, { orgId: orgB, roles: ['org_admin'] }))
      .rows[0];
    await rej(
      call(sys, A.setUserStatusAction, { userId: sole.id, status: 'suspended' }),
      'CONFLICT',
      // the only active admin
    );
    const seen = (await call(manager, A.listUsersAction)).rows;
    assert.ok(
      seen.length > 0 && seen.every((u: any) => u.role === 'investor'),
      'a fund manager only sees investors',
    );
    // the auditor has no users:view
    await rej(call(auditor, A.listUsersAction), 'FORBIDDEN');
  });

  test('sessions are re-validated against the database on every call', async () => {
    const f = await signIn('farah@crestline.test', PW, '2.2.2.2'),
      claims = decodeJwt(f.token) as any;
    assert.ok(await M.core.authenticateToken(f.token));
    const other = new TextEncoder().encode('another-secret-another-secret-12345678');
    const forged = await new SignJWT({ sv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(f.id)
      .setExpirationTime('1h')
      .sign(other);
    const expired = await new SignJWT({ sv: claims.sv })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(f.id)
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    const stale = await M.jwt.signSession({
      uid: f.id,
      sv: 99,
      role: claims.role,
      org: claims.org,
    });
    for (const t of [undefined, 'junk', forged, expired, stale])
      await rej(M.core.authenticateToken(t), 'UNAUTHENTICATED');
    await call(adminA, A.setUserStatusAction, { userId: f.id, status: 'suspended' });
    // still-valid JWT, suspended person
    await rej(M.core.authenticateToken(f.token), 'UNAUTHENTICATED');
    await call(adminA, A.setUserStatusAction, { userId: f.id, status: 'active' });
    await call(sys, A.setOrgStatusAction, { id: orgA, status: 'suspended' });
    // still-valid JWT, suspended organization
    await rej(M.core.authenticateToken(f.token), 'ORG_SUSPENDED');
    await rej(
      call(f, A.createFundAction, {
        code: 'LATE-1',
        name: 'Too late',
        category: 'Category I',
        targetSize: 1e8,
        minCommitment: 1e6,
        tenureYears: 5,
      }),
      'ORG_SUSPENDED',
    );
    await rej(
      call(
        null,
        A.loginAction,
        { email: 'farah@crestline.test', password: PW },
        undefined,
        '2.2.2.2',
      ),
      'ORG_SUSPENDED',
    );
    await call(sys, A.setOrgStatusAction, { id: orgA, status: 'active' });
    assert.ok(await M.core.authenticateToken(f.token));
    for (let i = 0; i < 5; i++)
      await rej(
        call(null, A.loginAction, { email: 'nobody@x.test', password: 'x' }, undefined, '3.3.3.3'),
        'UNAUTHENTICATED',
      );
    await rej(
      call(null, A.loginAction, { email: 'nobody@x.test', password: 'x' }, undefined, '3.3.3.3'),
      'THROTTLED',
      // the 6th wrong password in 15 minutes is blocked
    );
  });

  test('sign-in codes are random, never fixed, and stored only as a keyed hash', async () => {
    for (const who of ['anita', 'bharat', 'farah', 'admin'])
      await begin(`${who}@crestline.test`, PW, '9.9.8.8');
    assert.ok(sent.length >= 12, `have ${sent.length} codes to look at`);
    assert.ok(
      sent.every((m) => /^\d{6}$/.test(m.code)),
      'every code is 6 digits',
    );
    assert.ok(
      new Set(sent.map((m) => m.code)).size > sent.length / 2,
      'codes differ from one sign-in to the next',
    );
    for (const f of ['lib/actions/auth.ts', 'lib/notify.ts'])
      assert.ok(!fs.readFileSync(f, 'utf8').includes('123456'), `${f} has no hardcoded code`);
    const rows = await M.db.rows(M.db.pool(), 'SELECT * FROM login_challenges WHERE user_id = ?', [
      adminA.id,
    ]);
    const code = lastCode('admin@crestline.test');
    assert.ok(
      rows.length >= 1 &&
        rows.every(
          (r: any) =>
            /^[0-9a-f]{64}$/.test(r.code_hash) &&
            r.code_hash !== code &&
            !JSON.stringify(r).includes(code),
        ),
    );
  });

  test('a code allows only 3 wrong attempts in total; then the sign-in is locked', async () => {
    const email = 'admin2@crestline.test',
      ip = '9.9.9.1';
    let { r, otp } = await begin(email, PW, ip);
    assert.ok(r.ok && r.data.attemptsLeft === 3);
    const good1 = lastCode(email),
      bad = wrongFor(good1);
    let v = await verify(otp, bad, ip);
    assert.ok(!v.ok && v.code === 'OTP_INVALID' && /2 attempts left/.test(v.error));
    v = await verify(otp, bad, ip);
    assert.ok(!v.ok && v.code === 'OTP_INVALID' && /1 attempt left/.test(v.error));
    v = await verify(otp, bad, ip);
    // the third wrong code locks it
    assert.ok(!v.ok && v.code === 'OTP_RESTART');
    v = await verify(otp, good1, ip);
    // even the right code is now useless
    assert.ok(!v.ok && v.code === 'OTP_RESTART');
    assert.equal(
      (
        await M.db.one(
          M.db.pool(),
          `SELECT status FROM login_challenges WHERE token_hash = SHA2(?, 256)`,
          [otp],
        )
      ).status,
      'locked',
    );
    assert.ok(
      await M.db.one(M.db.pool(), `SELECT 1 x FROM audit_log WHERE action = 'auth.otp_locked'`),
    );
    assert.ok(!jar.has('aif_session'), 'no session was created');
    // two wrong codes and then the right one still signs in
    ({ r, otp } = await begin(email, PW, ip));
    const c2 = lastCode(email);
    assert.equal((await verify(otp, wrongFor(c2), ip)).code, 'OTP_INVALID');
    assert.equal((await verify(otp, wrongFor(c2), ip)).code, 'OTP_INVALID');
    v = await verify(otp, c2, ip);
    assert.ok(v.ok && v.data.home === '/admin');
    assert.ok(
      jar.has('aif_session') && !jar.has('aif_otp'),
      'session set, one-time cookie cleared',
    );
    v = await verify(otp, c2, ip);
    // a code works once
    assert.ok(!v.ok && v.code === 'OTP_RESTART');
    // a malformed code never counts as an attempt
    assert.equal((await verify(otp, '12ab', ip)).code, 'VALIDATION');
  });

  test("codes expire, a new sign-in replaces the old one, and one person's code cannot finish another's sign-in", async () => {
    const ip = '9.9.9.2',
      a = 'chitra@crestline.test',
      b = 'arjun@crestline.test';
    let s = await begin(a, PW, ip);
    await M.db.exec(
      M.db.pool(),
      `UPDATE login_challenges SET expires_at = ? WHERE token_hash = SHA2(?, 256)`,
      [new Date(Date.now() - 1000), s.otp],
    );
    // expired
    assert.equal((await verify(s.otp, lastCode(a), ip)).code, 'OTP_RESTART');
    const first = await begin(a, PW, ip),
      firstCode = lastCode(a);
    // starting again replaces the first
    const second = await begin(a, PW, ip);
    assert.equal((await verify(first.otp, firstCode, ip)).code, 'OTP_RESTART');
    assert.ok((await verify(second.otp, lastCode(a), ip)).ok);
    const sa = await begin(a, PW, ip),
      codeA = lastCode(a);
    await begin(b, PW, ip);
    const codeB = lastCode(b);
    // B's code on A's sign-in
    assert.equal((await verify(sa.otp, codeB, ip)).code, 'OTP_INVALID');
    // no handle at all
    assert.equal((await verify(undefined, codeA, ip)).code, 'OTP_RESTART');
    assert.ok((await verify(sa.otp, codeA, ip)).ok);
  });

  test('resending a code has a cooldown and a limit, and does not forgive wrong attempts', async () => {
    const email = 'admin3@crestline.test',
      ip = '9.9.9.3';
    await person(adminA, 'Third Admin', email, 'org_admin');
    const s = await begin(email, PW, ip);
    const resend = async () => {
      jar.clear();
      jar.set('aif_otp', s.otp);
      return A.resendOtpAction();
    };
    const age = (sec: number) =>
      M.db.exec(
        M.db.pool(),
        `UPDATE login_challenges SET last_sent_at = ? WHERE token_hash = SHA2(?, 256)`,
        [new Date(Date.now() - sec * 1000), s.otp],
      );
    // too soon
    assert.equal((await resend()).code, 'THROTTLED');
    const c1 = lastCode(email);
    await age(31);
    assert.ok((await resend()).ok);
    const c2 = lastCode(email);
    // the earlier code no longer works (attempt 1)
    assert.equal((await verify(s.otp, c1 === c2 ? wrongFor(c1) : c1, ip)).code, 'OTP_INVALID');
    await age(31);
    // 3 codes have now been sent
    assert.ok((await resend()).ok);
    await age(31);
    // no more than 3 sends
    assert.equal((await resend()).code, 'OTP_RESTART');
    const c3 = lastCode(email);
    // attempt 2
    assert.equal((await verify(s.otp, wrongFor(c3), ip)).code, 'OTP_INVALID');
    // attempt 3 locks it: resends did not reset the count
    assert.equal((await verify(s.otp, wrongFor(c3), ip)).code, 'OTP_RESTART');
    // asking for codes over and over is capped
    let capped = false;
    for (let i = 0; i < 8 && !capped; i++)
      capped = (await begin(email, PW, ip)).r.code === 'THROTTLED';
    assert.ok(capped, 'too many codes requested for one account');
  });

  test('org users and the system admin sign in on separate pages', async () => {
    // system admin on its own page: fine
    const a = (await begin(SYS, 'SystemPassword!2026', '9.9.9.4')).r;
    assert.ok(a.ok);
    jar.clear();
    // ...but not on the shared page
    const onShared = await A.loginAction({ email: SYS, password: 'SystemPassword!2026' });
    jar.clear();
    // org admin on the system page
    const onSystem = await A.systemLoginAction({ email: 'admin@crestline.test', password: PW });
    jar.clear();
    const wrong = await A.loginAction({
      email: 'admin@crestline.test',
      password: 'wrong-password-123',
    });
    for (const r of [onShared, onSystem, wrong]) assert.ok(!r.ok && r.code === 'UNAUTHENTICATED');
    assert.equal(onShared.error, onSystem.error);
    assert.equal(
      onSystem.error,
      wrong.error,
      'the same message in every case: nothing reveals which page an account belongs to',
    );
    assert.equal((await signIn(SYS, 'SystemPassword!2026', '9.9.9.4')).role, 'system_admin');
    // the role comes from the database
    assert.equal((await signIn('anita@crestline.test', PW, '9.9.9.6')).role, 'investor');
    assert.equal((await signIn('farah@crestline.test', PW, '9.9.9.7')).role, 'fund_manager');
    jar.clear();
    const home = await begin('farah@crestline.test', PW, '9.9.9.7');
    const v = await verify(home.otp, lastCode('farah@crestline.test'), '9.9.9.7');
    assert.equal(v.data.home, '/manager');
  });

  test('the session token carries id, issuer, audience, role, organization and a unique id', async () => {
    const w1 = await signIn('admin@crestline.test', PW, '9.9.9.8'),
      c = decodeJwt(w1.token) as any;
    assert.equal(c.sub, adminA.id);
    assert.equal(c.iss, 'aif-platform');
    assert.equal(c.aud, 'aif-platform-web');
    assert.equal(c.role, 'org_admin');
    assert.equal(c.org, orgA);
    assert.match(String(c.jti), /^[0-9a-f-]{36}$/);
    assert.equal(
      c.exp - c.iat,
      8 * 3600,
      'a session lasts 8 hours and is not extended by activity',
    );
    assert.notEqual(c.jti, (decodeJwt(adminA.token) as any).jti, 'every session has its own id');
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const mk = (iss: string, aud: string) =>
      new SignJWT({ sv: 1, role: 'org_admin', org: orgA })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(adminA.id)
        .setIssuer(iss)
        .setAudience(aud)
        .setJti('x')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
    await rej(
      M.core.authenticateToken(await mk('someone-else', 'aif-platform-web')),
      'UNAUTHENTICATED',
      // wrong issuer
    );
    // wrong audience
    await rej(M.core.authenticateToken(await mk('aif-platform', 'another-app')), 'UNAUTHENTICATED');
    // role changed in the database: the old token dies
    const b = await signIn('bharat@crestline.test', PW, '9.9.9.10');
    assert.ok(await M.core.authenticateToken(b.token));
    await M.db.exec(M.db.pool(), `UPDATE users SET role = 'auditor' WHERE id = ?`, [b.id]);
    await rej(M.core.authenticateToken(b.token), 'UNAUTHENTICATED');
    await M.db.exec(M.db.pool(), `UPDATE users SET role = 'investor' WHERE id = ?`, [b.id]);
  });

  test('every change is in a hash-chained audit trail that cannot be edited', async () => {
    const v = await call(sys, A.verifyAuditAction);
    assert.equal(v.valid, true);
    assert.ok(v.checked > 40);
    // only the system admin runs the chain check
    await rej(call(adminA, A.verifyAuditAction), 'FORBIDDEN');
    await assert.rejects(
      M.db.pool().query("UPDATE audit_log SET action = 'x' WHERE id = 1"),
      /append-only/,
    );
    await assert.rejects(M.db.pool().query('DELETE FROM audit_log WHERE id = 1'), /append-only/);
    const everything = async (who: Who) => {
      const out: any[] = [];
      let before: number | undefined;
      do {
        const p = await call(who, A.listAuditAction, { before, limit: 200 });
        out.push(...p.entries);
        before = p.nextBefore ?? undefined;
      } while (before);
      return out;
    };
    const orgView = await everything(adminA),
      sysView = await everything(sys);
    assert.ok(orgView.length > 0 && orgView.every((e: any) => e.orgName === 'Crestline Capital'));
    assert.ok(
      sysView.some((e: any) => e.orgName === 'Meridian Funds') &&
        sysView.some((e: any) => e.orgName === 'Crestline Capital'),
    );
    // the same action serves "load more"
    const first = await call(adminA, A.listAuditAction, { limit: 5 });
    const more = await call(adminA, A.listAuditAction, {
      before: first.entries.at(-1).id,
      limit: 5,
    });
    assert.equal(first.entries.length, 5);
    assert.ok(more.entries.every((e: any) => e.id < first.entries.at(-1).id));
    await rej(call(inv1, A.listAuditAction, {}), 'FORBIDDEN');
    const leaked = JSON.stringify(sysView);
    assert.ok(
      !leaked.includes('ABCPR1234K') && !leaked.includes('123456789012'),
      'no identity numbers in the audit log',
    );
  });

  test('an organization chooses its own type; the system admin does not', async () => {
    const typeOf = async (who: Who) => (await call(who, A.listOrgsAction))[0].type;
    assert.equal(await typeOf(adminA), null, 'a new organization has no type until it picks one');
    assert.equal(await typeOf(adminB), null);
    // the system admin can fix the name and registration number, but a type sent along is ignored
    await call(sys, A.updateOrgAction, {
      id: orgA,
      name: 'Crestline Capital',
      registrationNo: 'IN/AIF2/22-23/1048',
      type: 'Trustee',
    } as any);
    assert.equal(await typeOf(adminA), null, 'the system admin cannot set the type');
    // the org admin sets it
    await rej(
      call(adminA, A.updateOwnOrgAction, { type: 'Hedge fund', registrationNo: '' }),
      'VALIDATION',
      // only the offered options
    );
    // a type is required
    await rej(call(adminA, A.updateOwnOrgAction, { registrationNo: '' } as any), 'VALIDATION');
    await call(adminA, A.updateOwnOrgAction, {
      type: 'AIF manager',
      registrationNo: 'IN/AIF2/22-23/1048',
    });
    const mine = (await call(adminA, A.listOrgsAction))[0];
    assert.equal(mine.type, 'AIF manager');
    assert.equal(mine.registrationNo, 'IN/AIF2/22-23/1048');
    assert.equal(
      await typeOf(adminB),
      null,
      "another organization is untouched: the action only ever acts on the caller's own organization",
    );
    assert.equal(
      (await call(sys, A.getOrgAction, { id: orgA })).org.type,
      'AIF manager',
      'the system admin can see it',
    );
    // nobody else may change it
    for (const who of [sys, manager, compliance, auditor, inv1])
      await rej(
        call(who, A.updateOwnOrgAction, { type: 'Trustee', registrationNo: '' }),
        'FORBIDDEN',
      );
    assert.ok(
      await M.db.one(M.db.pool(), `SELECT 1 x FROM audit_log WHERE action = 'org.profile_update'`),
      'the change is audited',
    );
    // each organization picks its own
    await call(adminB, A.updateOwnOrgAction, { type: 'Trustee', registrationNo: '' });
    assert.equal(await typeOf(adminB), 'Trustee');
    assert.equal(await typeOf(adminA), 'AIF manager');
  });

  test('shared read actions allow exactly the roles they should', async () => {
    // one action per read; the roles that may call it are decided by authorize() inside it
    const matrix: [string, (i?: any) => Promise<any>, any, Who[], Who[]][] = [
      [
        'listFundsAction',
        A.listFundsAction,
        undefined,
        [adminA, manager, compliance, auditor],
        [sys, inv1],
      ],
      [
        'listInvestorsAction',
        A.listInvestorsAction,
        undefined,
        [adminA, manager, compliance, auditor],
        [sys, inv1],
      ],
      [
        'listAuditAction',
        A.listAuditAction,
        {},
        [sys, adminA, compliance, auditor],
        [manager, inv1],
      ],
      [
        'orgStatsAction',
        A.orgStatsAction,
        undefined,
        [adminA, manager, compliance, auditor],
        [sys, inv1],
      ],
      ['listUsersAction', A.listUsersAction, {}, [adminA, manager], [compliance, auditor, inv1]],
      [
        'listAssignableInvestorsAction',
        A.listAssignableInvestorsAction,
        { fundId },
        [manager],
        [adminA, compliance, auditor, inv1, sys],
      ],
      [
        'listOrgsAction',
        A.listOrgsAction,
        undefined,
        [sys, adminA],
        [manager, compliance, auditor, inv1],
      ],
      [
        'getOwnKycAction',
        A.getOwnKycAction,
        undefined,
        [inv1, inv2],
        [adminA, manager, compliance, auditor, sys],
      ],
      [
        'listMyFundsAction',
        A.listMyFundsAction,
        undefined,
        [inv1],
        [adminA, manager, compliance, auditor, sys],
      ],
      ['investorSummaryAction', A.investorSummaryAction, undefined, [inv1], [adminA, manager, sys]],
      [
        'platformStatsAction',
        A.platformStatsAction,
        undefined,
        [sys],
        [adminA, manager, compliance, auditor, inv1],
      ],
    ];
    for (const [name, fn, arg, allowed, denied] of matrix) {
      for (const who of allowed)
        await call(who, fn, arg).catch((e: any) =>
          assert.fail(`${name} should allow ${who.role}: ${e.message}`),
        );
      for (const who of denied) await rej(call(who, fn, arg), 'FORBIDDEN');
      // and nobody signed out
      await rej(call(null, fn, arg), 'UNAUTHENTICATED');
    }
    // an unverified investor gets nothing but their KYC
    await rej(call(inv2, A.listMyFundsAction), 'KYC_REQUIRED');
    await rej(call(inv2, A.investorSummaryAction), 'KYC_REQUIRED');
    // a shared read only ever returns the caller's own organization
    assert.equal((await call(adminB, A.listFundsAction)).rows.length, 0);
    assert.ok((await call(manager, A.listFundsAction)).rows.length >= 2);
    const masked = await call(auditor, A.getInvestorKycAction, { investorId: inv1.id }),
      full = await call(compliance, A.getInvestorKycAction, { investorId: inv1.id });
    assert.ok(
      !masked.fullDetailsVisible && full.fullDetailsVisible,
      'the same read returns more or less depending on the role',
    );
    assert.deepEqual(
      (await call(manager, A.listUsersAction)).rows
        .map((u: any) => u.role)
        .filter((r: string) => r !== 'investor'),
      [],
      'a fund manager sees investors only',
    );
    // a system admin must name the organization
    await rej(call(sys, A.listUsersAction, {}), 'VALIDATION');
    assert.ok(
      (await call(sys, A.listUsersAction, { orgId: orgA, roles: ['org_admin'] })).rows.every(
        (u: any) => u.role === 'org_admin',
      ),
    );
    await rej(call(adminA, A.getOrgAction, { id: orgB }), 'NOT_FOUND');
    assert.equal((await call(sys, A.getOrgAction, { id: orgB })).org.name, 'Meridian Funds');
  });

  test('lists paginate and search on the server, and bad paging input is rejected', async () => {
    const all = await call(adminA, A.listUsersAction);
    assert.ok(all.total >= 6 && all.rows.length === Math.min(all.total, 20));
    const first = await call(adminA, A.listUsersAction, { limit: 2, page: 1 }),
      second = await call(adminA, A.listUsersAction, { limit: 2, page: 2 });
    assert.equal(first.rows.length, 2);
    assert.equal(first.totalPages, Math.ceil(all.total / 2));
    assert.ok(
      first.rows.every((u: any) => !second.rows.some((v: any) => v.id === u.id)),
      'pages do not overlap',
    );
    const found = await call(adminA, A.listUsersAction, { search: 'anita' });
    assert.deepEqual(
      found.rows.map((u: any) => u.email),
      ['anita@crestline.test'],
    );
    assert.equal(
      (await call(adminA, A.listUsersAction, { search: '%' })).total,
      0,
      'a % in the search is a literal character, not a wildcard',
    );
    assert.equal(
      (await call(adminB, A.listUsersAction, { search: 'anita' })).total,
      0,
      'search never crosses organizations',
    );
    for (const bad of [{ limit: 1000 }, { page: 0 }, { page: 'x' }])
      await rej(call(adminA, A.listUsersAction, bad), 'VALIDATION');
    assert.equal((await call(adminA, A.listFundsAction, { search: 'no-such-fund' })).total, 0);
    assert.ok(
      (await call(compliance, A.listInvestorsAction, { search: 'anita' })).rows.every((i: any) =>
        i.name.toLowerCase().includes('anita'),
      ),
    );
  });

  test('ending a session clears the stale cookie, so a signed-but-rejected cookie cannot loop', async () => {
    const { GET } = await import('../app/session/end/route');
    const { NextRequest } = await import('next/server');
    for (const [q, to] of [
      ['', '/login'],
      ['?to=system', '/system/login'],
    ]) {
      const res = GET(new NextRequest(`http://localhost:3000/session/end${q}`));
      assert.equal(res.status, 307);
      const loc = new URL(res.headers.get('location')!);
      assert.equal(loc.pathname, to);
      assert.equal(loc.searchParams.get('reason'), 'expired');
      assert.match(
        res.headers.get('set-cookie') ?? '',
        /aif_session=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i,
      );
    }
    const mw = fs.readFileSync('middleware.ts', 'utf8');
    assert.ok(mw.includes("'/session/end'"), 'the route is reachable without a session');
    assert.ok(
      !/NextResponse\.redirect\(new URL\('\/', req\.url\)\)/.test(mw),
      'middleware must never bounce login pages on signature alone',
    );
  });

  test('no Server Action can skip the session check', () => {
    // Every exported action must call authorize() before touching the database, except these sign-
    // in actions that run before a session exists.
    const PUBLIC = new Set([
      'loginAction',
      'systemLoginAction',
      'verifyOtpAction',
      'resendOtpAction',
      'acceptInviteAction',
      'logoutAction',
    ]);
    const seen: string[] = [],
      skipping: string[] = [];
    for (const f of fs.readdirSync('lib/actions')) {
      const src = fs.readFileSync(`lib/actions/${f}`, 'utf8');
      if (!src.startsWith("'use server'")) continue;
      assert.ok(
        !/^export (const|let|var|class|default|function)\b/m.test(src),
        `${f}: a 'use server' file may only export async functions`,
      );
      for (const chunk of src.split(/^export async function /m).slice(1)) {
        const name = chunk.slice(0, chunk.indexOf('('));
        seen.push(name);
        const at = chunk.indexOf('authorize(');
        if (at === -1) {
          skipping.push(name);
          continue;
        }
        const firstQuery = chunk.search(/\b(tx|one|rows|exec)\(|pool\(\)/);
        assert.ok(
          firstQuery === -1 || at < firstQuery,
          `${name} touches the database before it calls authorize()`,
        );
      }
    }
    assert.ok(seen.length >= 25, `found ${seen.length} actions`);
    assert.deepEqual(
      skipping.sort(),
      [...PUBLIC].sort(),
      'the only actions without authorize() are the public sign-in ones',
    );
  });
});
