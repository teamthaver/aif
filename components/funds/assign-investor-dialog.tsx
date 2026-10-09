'use client';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { assignInvestorAction } from '@/lib/actions/funds';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/shared/field';
import { useRunner } from '@/components/shared/use-runner';
import { fmtMoney } from '@/lib/format';
import type { InvestorOption } from '@/utils/types';

export function AssignInvestorDialog({
  fundId,
  investors,
  minCommitment,
}: {
  fundId: string;
  investors: InvestorOption[];
  minCommitment: number;
}) {
  const { run, busy } = useRunner();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ investorId: '', amount: '', notes: '' });

  async function submit() {
    if (
      await run(
        () =>
          assignInvestorAction({
            fundId,
            investorId: f.investorId,
            commitmentAmount: Number(f.amount),
            notes: f.notes,
          }),
        'Investor assigned',
      )
    ) {
      setOpen(false);
      setF({ investorId: '', amount: '', notes: '' });
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Assign investor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign an investor</DialogTitle>
          <DialogDescription>
            Only investors with verified KYC appear here. Minimum commitment:{' '}
            {fmtMoney(minCommitment)}.
          </DialogDescription>
        </DialogHeader>
        {investors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verified investors are available. Create an investor and wait for their KYC to be
            verified.
          </p>
        ) : (
          <div className="grid gap-4">
            <Field label="Investor">
              <Select
                value={f.investorId}
                onValueChange={(investorId) => setF({ ...f, investorId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an investor" />
                </SelectTrigger>
                <SelectContent>
                  {investors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} · {i.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Commitment (₹)" htmlFor="a-amt">
              <Input
                id="a-amt"
                type="number"
                min="0"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </Field>
            <Field label="Notes (optional)" htmlFor="a-notes">
              <Input
                id="a-notes"
                value={f.notes}
                maxLength={300}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {investors.length > 0 && (
            <Button onClick={submit} disabled={busy || !f.investorId}>
              Assign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
