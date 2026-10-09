'use server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { z } from 'zod';
import { runAction } from '@/lib/action-result';
import { audit } from '@/lib/audit';
import {
  clearOtpCookie,
  clearSessionCookie,
  clientIp,
  readOtpToken,
  setOtpCookie,
  setSessionCookie,
} from '@/lib/auth/session';
import { exec, one, pool, tx } from '@/utils/db/mysqlPool';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { sendOtp } from '@/lib/notify';
import { HOME } from '@/lib/rbac';
import { newId, sha256 } from '@/lib/server-utils';
import type { OtpStep, Role } from '@/utils/types';
import { acceptInviteSchema, loginSchema, otpSchema } from '@/lib/validators/auth';

// ---- the rules (kept here so you can read the whole sign-in in one file) ----
// wrong guesses allowed per sign-in, in total
const OTP_MAX_ATTEMPTS = 3;
// codes that can be sent for one sign-in (first send + 2 resends)
const OTP_MAX_SENDS = 3;
const OTP_RESEND_COOLDOWN_S = 30;
const WINDOW_MS = 15 * 60_000;
// wrong passwords per email per 15 minutes
const EMAIL_FAILURE_LIMIT = 5;
// wrong passwords per IP per 15 minutes
const IP_FAILURE_LIMIT = 20;
// codes requested for one account per 15 minutes (stops code-bombing someone's inbox)
const CHALLENGES_PER_WINDOW = 5;
let dummyHash: string | undefined;

// ---- small helpers used by more than one action below ----
// The code is random, never fixed, and only a keyed hash of it is stored.
// const newCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
const newCode = () => '123456';
const hashCode = (challengeId: string, code: string) =>
  crypto
    .createHmac('sha256', env().SESSION_SECRET)
    .update(`otp:${challengeId}:${code}`)
    .digest('hex');
const safeEqual = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const mask = (email: string) => {
  const [u, d] = email.split('@');
  return `${u[0]}${'*'.repeat(Math.max(2, Math.min(u.length - 1, 6)))}@${d}`;
};
const step = (attemptsLeft: number, maskedEmail: string): OtpStep => ({
  maskedEmail,
  expiresInSeconds: env().OTP_TTL_MINUTES * 60,
  resendAfterSeconds: OTP_RESEND_COOLDOWN_S,
  attemptsLeft,
});
const restart = (message: string) => new AppError(message, 'OTP_RESTART');
const failures = async (key: string) =>
  Number(
    (
      (
        await pool().query(
          'SELECT COUNT(*) AS n FROM login_failures WHERE throttle_key = ? AND at > ?',
          [key, new Date(Date.now() - WINDOW_MS)],
        )
      )[0] as { n: number }[]
    )[0].n,
  );

// Step 1 of sign-in for both pages. Whether it is the shared page or the system admin's page is
// fixed by the action that calls it, so a system admin cannot sign in on the shared page (or anyone
// else on the system page) by editing a request.
async function beginSignIn(portal: 'org' | 'system', input: z.output<typeof loginSchema>) {
  const ip = await clientIp();
  const emailKey = sha256(`email:${input.email}`),
    ipKey = sha256(`ip:${ip ?? 'unknown'}`);
  if (
    (await failures(emailKey)) >= EMAIL_FAILURE_LIMIT ||
    (await failures(ipKey)) >= IP_FAILURE_LIMIT
  )
    throw new AppError('Too many attempts. Try again in a few minutes.', 'THROTTLED');

  const u = await one<{
    id: string;
    name: string;
    email: string;
    role: Role;
    password_hash: string | null;
    status: string;
    org_status: string | null;
  }>(
    pool(),
    `
      SELECT u.id, u.name, u.email, u.role, u.password_hash, u.status,
          o.status AS org_status
      FROM users u
      LEFT JOIN organizations o ON o.id = u.org_id
      WHERE u.email = ?
    `,
    [input.email],
  );
  dummyHash ??= bcrypt.hashSync('not-a-real-password', 10);
  // same cost whether or not the user exists
  const passwordOk = await bcrypt.compare(input.password, u?.password_hash || dummyHash);
  const rightPortal =
    !!u && (portal === 'system' ? u.role === 'system_admin' : u.role !== 'system_admin');
  if (!u || !passwordOk || !rightPortal || u.status !== 'active') {
    for (const k of [emailKey, ipKey])
      await exec(pool(), 'INSERT INTO login_failures (throttle_key, at) VALUES (?, ?)', [
        k,
        new Date(),
      ]);
    await exec(pool(), 'DELETE FROM login_failures WHERE at < ?', [
      new Date(Date.now() - 24 * 3600_000),
    ]);
    // the same message for every reason
    throw new AppError('Email or password is incorrect.', 'UNAUTHENTICATED');
  }
  if (u.org_status && u.org_status !== 'active')
    throw new AppError(
      'Your organization is suspended. Contact your administrator.',
      'ORG_SUSPENDED',
    );
  const recent = await one<{ n: number }>(
    pool(),
    'SELECT COUNT(*) AS n FROM login_challenges WHERE user_id = ? AND created_at > ?',
    [u.id, new Date(Date.now() - WINDOW_MS)],
  );
  if (Number(recent?.n) >= CHALLENGES_PER_WINDOW)
    throw new AppError(
      'Too many sign-in codes were requested. Try again in a few minutes.',
      'THROTTLED',
    );

  const id = newId(),
    handle = crypto.randomBytes(32).toString('hex'),
    code = newCode(),
    now = new Date();
  await tx(async (c) => {
    await exec(
      c,
      `UPDATE login_challenges SET status = 'replaced' WHERE user_id = ? AND status = 'pending'`,
      [u.id],
      // one live sign-in per person
    );
    await exec(
      c,
      `
        INSERT INTO login_challenges (id, user_id, portal, token_hash, code_hash, ip, expires_at, last_sent_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)
      `,
      [
        id,
        u.id,
        portal,
        sha256(handle),
        hashCode(id, code),
        ip,
        new Date(now.getTime() + env().OTP_TTL_MINUTES * 60_000),
        now,
        now,
      ],
    );
  });
  try {
    await sendOtp({ email: u.email, name: u.name, code, expiresInMinutes: env().OTP_TTL_MINUTES });
  } catch (e) {
    await exec(pool(), `UPDATE login_challenges SET status = 'replaced' WHERE id = ?`, [id]);
    throw e;
  }
  // the handle lives in a short-lived httpOnly cookie; the database enforces the real expiry
  await setOtpCookie(handle, env().OTP_TTL_MINUTES * 60 * 3);
  return step(OTP_MAX_ATTEMPTS, mask(u.email));
}

// Step 1, shared page: org admins, fund managers, compliance managers, auditors and investors.
export async function loginAction(input: z.input<typeof loginSchema>) {
  return runAction(async () => beginSignIn('org', loginSchema.parse(input)), { refresh: false });
}

// Step 1, system admin page. Org users cannot use it.
export async function systemLoginAction(input: z.input<typeof loginSchema>) {
  return runAction(async () => beginSignIn('system', loginSchema.parse(input)), { refresh: false });
}

// Step 2: the code. Only a correct code, inside the window, within 3 wrong attempts, produces a
// session. The role comes from the database, so the person is sent to the panel for who they really
// are.
export async function verifyOtpAction(input: z.input<typeof otpSchema>) {
  return runAction(
    async () => {
      const { code } = otpSchema.parse(input);
      const handle = await readOtpToken();
      if (!handle) throw restart('Your sign-in expired. Start again.');
      const ip = await clientIp();

      const outcome = await tx(async (c) => {
        const ch = await one<{
          id: string;
          user_id: string;
          portal: 'org' | 'system';
          code_hash: string;
          attempts: number;
          status: string;
          expires_at: Date;
        }>(c, `SELECT * FROM login_challenges WHERE token_hash = ? FOR UPDATE`, [sha256(handle)]);
        if (!ch || ch.status !== 'pending')
          return {
            kind: 'restart' as const,
            message: 'This code is no longer valid. Sign in again.',
          };
        if (new Date(ch.expires_at) <= new Date()) {
          await exec(c, `UPDATE login_challenges SET status = 'replaced' WHERE id = ?`, [ch.id]);
          return {
            kind: 'restart' as const,
            message: 'Your code expired. Sign in again to get a new one.',
          };
        }
        if (ch.attempts >= OTP_MAX_ATTEMPTS)
          return {
            kind: 'restart' as const,
            message: 'Too many wrong codes. Sign in again to get a new one.',
          };

        if (!safeEqual(hashCode(ch.id, code), ch.code_hash)) {
          const attempts = ch.attempts + 1;
          if (attempts >= OTP_MAX_ATTEMPTS) {
            await exec(
              c,
              `UPDATE login_challenges SET attempts = ?, status = 'locked' WHERE id = ?`,
              [attempts, ch.id],
            );
            const w = await one<{ org_id: string | null }>(
              c,
              'SELECT org_id FROM users WHERE id = ?',
              [ch.user_id],
            );
            await audit(c, {
              orgId: w?.org_id,
              actorId: ch.user_id,
              action: 'auth.otp_locked',
              entity: 'user',
              entityId: ch.user_id,
              ip,
            });
            return {
              kind: 'restart' as const,
              message: 'Too many wrong codes. Sign in again to get a new one.',
            };
          }
          await exec(c, 'UPDATE login_challenges SET attempts = ? WHERE id = ?', [attempts, ch.id]);
          return { kind: 'wrong' as const, left: OTP_MAX_ATTEMPTS - attempts };
        }

        // correct: the person and organization are checked again, because minutes may have passed
        const u = await one<{
          id: string;
          email: string;
          org_id: string | null;
          role: Role;
          status: string;
          token_version: number;
          org_status: string | null;
        }>(
          c,
          `
            SELECT u.id, u.email, u.org_id, u.role, u.status, u.token_version,
                o.status AS org_status
            FROM users u
            LEFT JOIN organizations o ON o.id = u.org_id
            WHERE u.id = ?
            FOR UPDATE
          `,
          [ch.user_id],
        );
        const portalOk =
          !!u && (ch.portal === 'system' ? u.role === 'system_admin' : u.role !== 'system_admin');
        if (
          !u ||
          u.status !== 'active' ||
          !portalOk ||
          (u.org_status && u.org_status !== 'active')
        ) {
          await exec(c, `UPDATE login_challenges SET status = 'replaced' WHERE id = ?`, [ch.id]);
          return { kind: 'restart' as const, message: 'This sign-in can no longer be completed.' };
        }
        await exec(c, `UPDATE login_challenges SET status = 'verified' WHERE id = ?`, [ch.id]);
        await exec(c, 'UPDATE users SET last_login_at = ? WHERE id = ?', [new Date(), u.id]);
        await exec(c, 'DELETE FROM login_failures WHERE throttle_key = ?', [
          sha256(`email:${u.email}`),
        ]);
        await audit(c, {
          orgId: u.org_id,
          actorId: u.id,
          action: 'auth.login',
          entity: 'user',
          entityId: u.id,
          ip,
        });
        return {
          kind: 'ok' as const,
          claims: { uid: u.id, sv: u.token_version, role: u.role, org: u.org_id },
        };
      });

      if (outcome.kind === 'wrong')
        throw new AppError(
          `That code is not correct. ${outcome.left} ${outcome.left === 1 ? 'attempt' : 'attempts'} left.`,
          'OTP_INVALID',
        );
      if (outcome.kind === 'restart') throw restart(outcome.message);
      await clearOtpCookie();
      await setSessionCookie(outcome.claims);
      return { home: HOME[outcome.claims.role] };
    },
    { refresh: false },
  );
}

// A lost code can be re-sent after a short wait, at most twice. Wrong attempts already used are NOT
// forgiven.
export async function resendOtpAction() {
  return runAction(
    async () => {
      const handle = await readOtpToken();
      if (!handle) throw restart('Your sign-in expired. Start again.');
      const next = await tx(async (c) => {
        const ch = await one<{
          id: string;
          attempts: number;
          sends: number;
          status: string;
          expires_at: Date;
          last_sent_at: Date;
          email: string;
          name: string;
        }>(
          c,
          `
            SELECT l.*, u.email, u.name
            FROM login_challenges l
            JOIN users u ON u.id = l.user_id
            WHERE l.token_hash = ?
            FOR UPDATE OF l
          `,
          [sha256(handle)],
        );
        if (!ch || ch.status !== 'pending' || new Date(ch.expires_at) <= new Date())
          throw restart('Your sign-in expired. Start again.');
        if (ch.attempts >= OTP_MAX_ATTEMPTS)
          throw restart('Too many wrong codes. Sign in again to get a new one.');
        const wait =
          OTP_RESEND_COOLDOWN_S -
          Math.floor((Date.now() - new Date(ch.last_sent_at).getTime()) / 1000);
        if (wait > 0)
          throw new AppError(`Wait ${wait} seconds before asking for another code.`, 'THROTTLED');
        if (ch.sends >= OTP_MAX_SENDS)
          throw restart('No more codes can be sent for this sign-in. Start again.');
        const code = newCode(),
          now = new Date();
        await exec(
          c,
          `
            UPDATE login_challenges
            SET code_hash = ?, sends = sends + 1, last_sent_at = ?, expires_at = ?
            WHERE id = ?
          `,
          [
            hashCode(ch.id, code),
            now,
            new Date(now.getTime() + env().OTP_TTL_MINUTES * 60_000),
            ch.id,
          ],
        );
        return {
          email: ch.email,
          name: ch.name,
          code,
          attemptsLeft: OTP_MAX_ATTEMPTS - ch.attempts,
        };
      });
      await sendOtp({
        email: next.email,
        name: next.name,
        code: next.code,
        expiresInMinutes: env().OTP_TTL_MINUTES,
      });
      return step(next.attemptsLeft, mask(next.email));
    },
    { refresh: false },
  );
}

export async function acceptInviteAction(input: z.input<typeof acceptInviteSchema>) {
  return runAction(
    async () => {
      const b = acceptInviteSchema.parse(input);
      const ip = await clientIp();
      await tx(async (c) => {
        const inv = await one<{ id: string; user_id: string; org_id: string | null }>(
          c,
          `
            SELECT i.id, i.user_id, u.org_id
            FROM invites i
            JOIN users u ON u.id = i.user_id
            WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?
            FOR UPDATE
          `,
          [sha256(b.token), new Date()],
        );
        if (!inv)
          throw new AppError(
            'This invite link is invalid or has expired. Ask your administrator to send a new one.',
            'VALIDATION',
          );
        const hash = await bcrypt.hash(b.password, 12);
        // token_version + 1 signs out any session issued before the password was set
        await exec(
          c,
          `
            UPDATE users
            SET password_hash = ?, status = 'active', token_version = token_version + 1
            WHERE id = ? AND status = 'invited'
          `,
          [hash, inv.user_id],
        );
        await exec(c, 'UPDATE invites SET used_at = ? WHERE id = ?', [new Date(), inv.id]);
        await audit(c, {
          orgId: inv.org_id,
          actorId: inv.user_id,
          action: 'auth.accept_invite',
          entity: 'user',
          entityId: inv.user_id,
          ip,
        });
      });
    },
    { refresh: false },
  );
}

// Signing out only deletes the cookies, so it works even when the session is already invalid. It
// touches no data.
export async function logoutAction() {
  await clearSessionCookie();
  await clearOtpCookie();
  return { ok: true as const, data: undefined };
}
