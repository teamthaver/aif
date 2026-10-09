'use client';
import { useState } from 'react';
import { setOrgStatusAction, updateOrgAction } from '@/lib/actions/organizations';
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
import type { OrgRow } from '@/utils/types';

export function OrgActions({ org }: { org: OrgRow }) {
  const { run, busy } = useRunner();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: org.name, registrationNo: org.registrationNo ?? '' });

  async function toggle() {
    const status = org.status === 'active' ? 'suspended' : 'active';
    if (
      status === 'suspended' &&
      !confirm(`Suspend ${org.name}? Everyone in it is blocked on their next click.`)
    )
      return;
    await run(
      () => setOrgStatusAction({ id: org.id, status }),
      `${org.name} ${status === 'active' ? 'reactivated' : 'suspended'}`,
    );
  }
  async function save() {
    if (await run(() => updateOrgAction({ id: org.id, ...f }), 'Organization updated'))
      setOpen(false);
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={toggle}>
        {org.status === 'active' ? 'Suspend' : 'Reactivate'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Organization name" htmlFor="e-name">
              <Input
                id="e-name"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Registration number" htmlFor="e-reg">
              <Input
                id="e-reg"
                value={f.registrationNo}
                onChange={(e) => setF({ ...f, registrationNo: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
