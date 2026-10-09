import bcrypt from 'bcryptjs';
import { exec, one, pool, tx } from '@/utils/db/mysqlPool';
import { createInvite } from '../lib/invites';
import { newId } from '../lib/server-utils';

// Creates the first system admin. Everything else is created from inside the app, following the
// hierarchy.
export async function seed(
  opts: { demo?: boolean; adminEmail?: string; adminPassword?: string } = {},
) {
  return tx(async (c) => {
    const email = (opts.adminEmail ?? process.env.SYSTEM_ADMIN_EMAIL ?? '').toLowerCase();
    const pw = opts.adminPassword ?? process.env.SYSTEM_ADMIN_PASSWORD ?? '';
    if (!email || pw.length < 12)
      throw new Error('Set SYSTEM_ADMIN_EMAIL and a SYSTEM_ADMIN_PASSWORD of 12+ characters');
    if (!(await one(c, 'SELECT 1 AS x FROM users WHERE email = ?', [email]))) {
      await exec(
        c,
        `INSERT INTO users (id, org_id, email, name, role, password_hash, status) VALUES (?, NULL, ?, 'System admin', 'system_admin', ?, 'active')`,
        [newId(), email, await bcrypt.hash(pw, 12)],
      );
    }
    let demoToken: string | null = null;
    if (
      opts.demo &&
      !(await one(c, `SELECT 1 AS x FROM organizations WHERE name = 'Crestline Capital'`))
    ) {
      const orgId = newId(),
        adminId = newId();
      await exec(
        c,
        `INSERT INTO organizations (id, name, registration_no) VALUES (?, 'Crestline Capital', 'IN/AIF2/22-23/1048')`,
        [orgId],
      );
      await exec(
        c,
        `INSERT INTO users (id, org_id, email, name, role, status) VALUES (?, ?, 'leela@crestline.test', 'Leela Menon', 'org_admin', 'invited')`,
        [adminId, orgId],
      );
      demoToken = await createInvite(c, adminId);
    }
    return { demoToken };
  });
}

if (process.argv[1]?.endsWith('seed.ts')) {
  (async () => {
    const { demoToken } = await seed({ demo: process.argv.includes('--demo') });
    console.log('Seeded the system admin.');
    if (demoToken)
      console.log(
        `Demo org admin (leela@crestline.test) invite: /accept-invite?token=${demoToken}`,
      );
    await pool().end();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
