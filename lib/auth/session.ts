import 'server-only';
import { cookies, headers } from 'next/headers';
import { env, isProd } from '../env';
import { signSession, type SessionClaims } from './jwt';

import { SESSION_COOKIE as COOKIE } from './constants';
export { COOKIE };

// The token lives only in an httpOnly cookie, so page scripts can never read it.
export async function setSessionCookie(claims: SessionClaims) {
  (await cookies()).set(COOKIE, await signSession(claims), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd(),
    path: '/',
    maxAge: env().SESSION_TTL_HOURS * 3600,
  });
}
export const clearSessionCookie = async () => {
  (await cookies()).delete(COOKIE);
};

// Holds the random handle of an in-progress sign-in (password accepted, code not yet entered).
// Lives only a few minutes.
export const OTP_COOKIE = 'aif_otp';
export async function setOtpCookie(token: string, seconds: number) {
  (await cookies()).set(OTP_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd(),
    path: '/',
    maxAge: seconds,
  });
}
export const readOtpToken = async () => (await cookies()).get(OTP_COOKIE)?.value;
export const clearOtpCookie = async () => {
  (await cookies()).delete(OTP_COOKIE);
};
export const readSessionToken = async () => (await cookies()).get(COOKIE)?.value;

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}
