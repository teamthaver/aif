'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewKycAction } from '@/lib/actions/kyc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useRunner } from '@/components/shared/use-runner';
import type { ReviewChecklist } from '@/utils/types';

const ITEMS: { key: keyof ReviewChecklist; label: string }[] = [
  { key: 'identityMatches', label: 'Name, date of birth and PAN match the PAN card' },
  { key: 'addressValid', label: 'Address proof is valid and matches the address given' },
  { key: 'bankValid', label: 'Bank proof is valid and the account holder name matches' },
  { key: 'photoClear', label: 'Photograph is clear and matches the ID' },
  { key: 'sanctionsScreened', label: 'Sanctions and PEP screening is done' },
];

export function KycReviewPanel({ investorId, backTo }: { investorId: string; backTo: string }) {
  const { run, busy } = useRunner();
  const router = useRouter();
  const [c, setC] = useState<ReviewChecklist>({
    identityMatches: false,
    addressValid: false,
    bankValid: false,
    photoClear: false,
    sanctionsScreened: false,
  });
  const [reason, setReason] = useState('');
  const all = Object.values(c).every(Boolean);

  async function decide(decision: 'verified' | 'rejected') {
    if (
      await run(
        () => reviewKycAction({ investorId, decision, reason, checklist: c }),
        decision === 'verified'
          ? 'Investor verified. They can now use their account.'
          : 'Sent back to the investor',
      )
    )
      router.push(backTo);
  }
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Your decision</CardTitle>
        <CardDescription>
          Open each document, then confirm every point before verifying.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2.5">
          {ITEMS.map((i) => (
            <label key={i.key} className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={c[i.key]}
                onCheckedChange={(v) => setC({ ...c, [i.key]: v === true })}
                className="mt-0.5"
              />
              {i.label}
            </label>
          ))}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            Reason (needed to reject; the investor sees this)
          </label>
          <Textarea
            id="reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The bank proof is blurry. Please upload a clear copy."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !all} onClick={() => decide('verified')}>
            Verify investor
          </Button>
          <Button
            variant="destructive"
            disabled={busy || reason.trim().length < 10}
            onClick={() => decide('rejected')}
          >
            Send back for changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
