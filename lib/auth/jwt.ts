import { jwtVerify, SignJWT } from 'jose';
import { env } from '../env';
import { ROLES } from '../rbac';
import type { Role } from '@/utils/types';

import { AUDIENCE, ISSUER } from './constants';

// What the session token carries. Role and org are a convenience and a tripwire, never the source
// of truth: every request re-reads them from the database and rejects the token if they no longer
// match.
export type SessionClaims = { uid: string; sv: number; role: Role; org: string | null };
export type VerifiedSession = SessionClaims & { jti: string; iat: number; exp: number };
const key = () => new TextEncoder().encode(env().SESSION_SECRET);

export const signSession = (c: SessionClaims) =>
  new SignJWT({ sv: c.sv, role: c.role, org: c.org })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    // sub: who
    .setSubject(c.uid)
    // iss: who issued it
    .setIssuer(ISSUER)
    // aud: who it is meant for
    .setAudience(AUDIENCE)
    // jti: unique id of this session token
    .setJti(crypto.randomUUID())
    // iat
    .setIssuedAt()
    // exp: hard stop, not extended by activity
    .setExpirationTime(`${env().SESSION_TTL_HOURS}h`)
    .sign(key());

// Returns null for anything missing, expired, tampered with, from another issuer/audience, or
// malformed
export async function verifySession(token?: string | null): Promise<VerifiedSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const { sub, jti, iat, exp, sv, role, org } = payload as Record<string, unknown>;
    if (
      typeof sub !== 'string' ||
      typeof jti !== 'string' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number' ||
      typeof sv !== 'number'
    )
      return null;
    if (typeof role !== 'string' || !ROLES.includes(role as Role)) return null;
    if (org !== null && typeof org !== 'string') return null;
    return { uid: sub, sv, role: role as Role, org: org as string | null, jti, iat, exp };
  } catch {
    return null;
  }
}
