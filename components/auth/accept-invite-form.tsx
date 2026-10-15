'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { acceptInviteAction } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { useRunner } from '@/components/shared/use-runner';

export function AcceptInviteForm({ token }: { token: string }) {
  const { run, busy } = useRunner();
  const [pw, setPw] = useState({ a: '', b: '' });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.a !== pw.b) return toast.error('The two passwords do not match.');
    if (await run(() => acceptInviteAction({ token, password: pw.a })))
      window.location.assign('/login?activated=1');
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="New password" htmlFor="a" hint="At least 6 characters.">
        <Input
          id="a"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={pw.a}
          onChange={(e) => setPw({ ...pw, a: e.target.value })}
        />
      </Field>
      <Field label="Confirm password" htmlFor="b">
        <Input
          id="b"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={pw.b}
          onChange={(e) => setPw({ ...pw, b: e.target.value })}
        />
      </Field>
      <Button disabled={busy}>Activate account</Button>
    </form>
  );
}
