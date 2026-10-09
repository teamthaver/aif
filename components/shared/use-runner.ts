'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ActionResult, ErrorCode } from '@/utils/types';

const onLoginPage = () => location.pathname === '/login' || location.pathname === '/system/login';
// The system admin signs in on their own page; everyone else uses the shared one
const loginUrl = () =>
  `/session/end${location.pathname === '/system' || location.pathname.startsWith('/system/') ? '?to=system' : ''}`;

// Runs a Server Action, shows the outcome as a toast, and sends people back to sign-in when their
// session has ended. Returns { data } on success and null on failure. onCode lets a caller react to
// a specific error (e.g. restart sign-in).
export function useRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run<T>(
    call: () => Promise<ActionResult<T>>,
    success?: string,
    onCode?: (code: ErrorCode) => void,
  ): Promise<{ data: T } | null> {
    setBusy(true);
    try {
      const r = await call();
      if (!r.ok) {
        toast.error(r.error);
        onCode?.(r.code);
        // session ended: back to the login page
        if (r.code === 'UNAUTHENTICATED' && !onLoginPage()) router.push(loginUrl());
        if (r.code === 'ORG_SUSPENDED' && !onLoginPage()) router.push('/blocked?why=org');
        if (r.code === 'KYC_REQUIRED') router.push('/investor/kyc');
        return null;
      }
      if (success) toast.success(success);
      return { data: r.data };
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}
