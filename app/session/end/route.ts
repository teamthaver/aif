import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

// Pages cannot delete cookies, so every "your session ended" redirect passes through here: it
// removes the stale session cookie, then sends the person to the right login page. Without this, a
// cookie that is correctly signed but rejected by the database would bounce between the app and the
// login page forever.
export function GET(req: NextRequest) {
  const system = req.nextUrl.searchParams.get('to') === 'system';
  const url = new URL(system ? '/system/login' : '/login', req.url);
  url.searchParams.set('reason', 'expired');
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
