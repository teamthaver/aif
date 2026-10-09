import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { AppError } from './errors';
import { can, HOME, type Permission } from './rbac';
import type { ActionResult, Ctx, Role } from '@/utils/types';
import { getKycStatus, loadSession } from './auth/authorize';
import { readSessionToken } from './auth/session';

export { getKycStatus };

// Layouts and pages in one render share a single validation. Each of them still validates for
// itself.
const perRender = cache(async (): Promise<{ ctx: Ctx } | { error: AppError }> => {
  try {
    return { ctx: await loadSession() };
  } catch (e) {
    if (e instanceof AppError) return { error: e };
    throw e;
  }
});

// Goes through /session/end, which clears the stale cookie and then lands on the login page
const endSessionUrl = (loginPath: string) =>
  loginPath === '/system/login' ? '/session/end?to=system' : '/session/end';

// Login pages call this: someone with a genuinely valid session (checked in the database) is
// forwarded to their panel
export async function redirectIfSignedIn(): Promise<void> {
  const r = await perRender();
  if ('ctx' in r) redirect(HOME[r.ctx.user.role]);
}

// ---- Guards for layouts and pages. They redirect; they never render for the wrong person. ----

export async function getCtxOrRedirect(loginPath = '/login'): Promise<Ctx> {
  const r = await perRender();
  if ('ctx' in r) return r.ctx;
  if (r.error.code === 'ORG_SUSPENDED') redirect('/blocked?why=org');
  // an ended session says so on the login page; someone who never signed in just gets the page
  redirect((await readSessionToken()) ? endSessionUrl(loginPath) : loginPath);
}

// Each role's layout calls this. Someone in the wrong panel is sent to their own.
export async function requireRole(...allowed: Role[]): Promise<Ctx> {
  const ctx = await getCtxOrRedirect(
    allowed.length === 1 && allowed[0] === 'system_admin' ? '/system/login' : '/login',
  );
  if (!allowed.includes(ctx.user.role)) redirect(HOME[ctx.user.role]);
  return ctx;
}

// Each page calls this too, because layouts and pages render in parallel and a page must not rely
// on its layout.
export async function requirePage(perm: Permission, ...allowed: Role[]): Promise<Ctx> {
  const ctx = await requireRole(...allowed);
  if (!can(ctx.user.role, perm)) redirect(HOME[ctx.user.role]);
  return ctx;
}

// Investors who have not passed KYC cannot open anything except the KYC page
export async function requireVerifiedInvestor(): Promise<Ctx> {
  const ctx = await requireRole('investor');
  if ((await getKycStatus(ctx.user.id)) !== 'verified') redirect('/investor/kyc');
  return ctx;
}

// Server pages read data by calling the same shared actions the browser can call. If a read fails,
// the person goes where they belong: session ended -> login, suspended -> notice, wrong role ->
// their own panel, unverified investor -> KYC, missing -> 404.
export async function pageData<T>(read: Promise<ActionResult<T>>): Promise<T> {
  const r = await read;
  if (r.ok) return r.data;
  switch (r.code) {
    case 'UNAUTHENTICATED':
      return redirect((await readSessionToken()) ? endSessionUrl('/login') : '/login');
    case 'ORG_SUSPENDED':
      return redirect('/blocked?why=org');
    case 'KYC_REQUIRED':
      return redirect('/investor/kyc');
    case 'FORBIDDEN':
      return redirect(HOME[(await getCtxOrRedirect()).user.role]);
    case 'NOT_FOUND':
    case 'VALIDATION':
      // a malformed id in the URL is simply not found
      return notFound();
    default:
      throw new Error(r.error);
  }
}
