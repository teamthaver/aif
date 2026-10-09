'use client';
import { useState } from 'react';
import { removeAssignmentAction, updateAssignmentAction } from '@/lib/actions/funds';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/field';
import { useRunner } from '@/components/shared/use-runner';
import type { AssignmentRow } from '@/utils/types';

export function AssignmentActions({ a, editable }: { a: AssignmentRow; editable: boolean }) {
  const { run, busy } = useRunner();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: String(a.commitmentAmount), notes: a.notes ?? '' });
  if (!editable || a.status !== 'active') return null;
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() =>
          confirm(`Remove ${a.investorName} from this fund?`) &&
          run(() => removeAssignmentAction({ assignmentId: a.id }), 'Investor removed')
        }
      >
        Remove
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commitment for {a.investorName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field
              label="Commitment (₹)"
              htmlFor="c-amt"
              hint="Changing the amount asks the investor to confirm again."
            >
              <Input
                id="c-amt"
                type="number"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </Field>
            <Field label="Notes" htmlFor="c-notes">
              <Input
                id="c-notes"
                value={f.notes}
                maxLength={300}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (
                  await run(
                    () =>
                      updateAssignmentAction({
                        assignmentId: a.id,
                        commitmentAmount: Number(f.amount),
                        notes: f.notes,
                      }),
                    'Commitment updated',
                  )
                )
                  setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
