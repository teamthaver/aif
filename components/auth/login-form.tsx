'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  loginAction,
  resendOtpAction,
  systemLoginAction,
  verifyOtpAction,
} from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { useRunner } from '@/components/shared/use-runner';
import type { OtpStep } from '@/utils/types';

// One component for both sign-in pages. portal="system" is used only by the system admin's own
// page.
export function LoginForm({ portal }: { portal: 'org' | 'system' }) {
  const { run, busy } = useRunner();
  const [f, setF] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [otp, setOtp] = useState<OtpStep | null>(null);
  // seconds until "Resend code" is available
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const r = await run(() => (portal === 'system' ? systemLoginAction(f) : loginAction(f)));
    if (r) {
      setOtp(r.data);
      setWait(r.data.resendAfterSeconds);
      setCode('');
      toast.success(`We sent a 6-digit code to ${r.data.maskedEmail}`);
    }
  }
  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const r = await run(
      () => verifyOtpAction({ code }),
      undefined,
      (c) => {
        if (c === 'OTP_RESTART') {
          setOtp(null);
          setCode('');
          setF({ ...f, password: '' });
          // locked or expired: back to the password step
        }
        if (c === 'OTP_INVALID') {
          setOtp((o) => o && { ...o, attemptsLeft: o.attemptsLeft - 1 });
          setCode('');
        }
      },
    );
    // straight into the panel for the role stored in the database
    if (r) window.location.assign(r.data.home);
  }
  async function resend() {
    const r = await run(
      () => resendOtpAction(),
      'A new code is on its way',
      (c) => {
        if (c === 'OTP_RESTART') setOtp(null);
      },
    );
    if (r) {
      setOtp(r.data);
      setWait(r.data.resendAfterSeconds);
      setCode('');
    }
  }

  if (otp) {
    return (
      <form onSubmit={submitCode} className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code we sent to <b className="text-foreground">{otp.maskedEmail}</b>. It
          expires in {Math.round(otp.expiresInSeconds / 60)} minutes.
        </p>
        <Field
          label="Sign-in code"
          htmlFor="otp"
          hint={`${otp.attemptsLeft} ${otp.attemptsLeft === 1 ? 'attempt' : 'attempts'} left`}
        >
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Button disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Verify and sign in'}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              setOtp(null);
              setCode('');
            }}
          >
            Use a different account
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            disabled={busy || wait > 0}
            onClick={resend}
          >
            {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
          </Button>
        </div>
      </form>
    );
  }
  return (
    <form onSubmit={submitPassword} className="grid gap-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
      </Field>
      <Button disabled={busy}>{busy ? 'Checking…' : 'Continue'}</Button>
    </form>
  );
}
