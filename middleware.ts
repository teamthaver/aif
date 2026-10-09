import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import { AUDIENCE, ISSUER, SESSION_COOKIE } from '@/lib/auth/constants';

const OPEN = ['/login', '/system/login', '/accept-invite', '/session/end'];

// A fast first gate only: it checks the cookie's signature, issuer, audience and expiry, and never
// trusts it for access. Every page and every Server Action re-validates the session against the
// database.
export async function middleware(req: NextRequest) {
  // actions answer for themselves with UNAUTHENTICATED
  if (req.headers.has('next-action')) return NextResponse.next();
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let valid = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      valid = true;
    } catch {
      /* expired or forged */
    }
  }
  const open = OPEN.includes(pathname);
  if (!valid && !open) {
    // The system admin has their own sign-in page; everyone else shares /login. An ended session
    // says so.
    const loginPath =
      pathname === '/system' || pathname.startsWith('/system/') ? '/system/login' : '/login';
    const url = new URL(loginPath, req.url);
    if (token) url.searchParams.set('reason', 'expired');
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  // A valid signature is not proof of a valid session, so the login pages decide for themselves
  // (against the database) whether to forward someone who is already signed in.
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
