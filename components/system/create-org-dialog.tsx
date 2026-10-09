'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { createOrgAction } from '@/lib/actions/organizations';
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
import { Field } from '@/components/shared/field';
import { showInviteLink } from '@/components/shared/invite-toast';
import { useRunner } from '@/components/shared/use-runner';

const blank = { name: '', registrationNo: '', adminName: '', adminEmail: '' };

export function CreateOrgDialog() {
  const { run, busy } = useRunner();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit() {
    const r = await run(() => createOrgAction(f), 'Organization created');
    if (r) {
      setOpen(false);
      setF(blank);
      showInviteLink(r.data.adminEmail, r.data.inviteToken);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>
            You invite its first organization admin, who sets up the organization's own details
            (such as its type) and creates everyone else.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Organization name" htmlFor="o-name">
            <Input id="o-name" value={f.name} onChange={set('name')} />
          </Field>
          <Field label="Registration number (optional)" htmlFor="o-reg">
            <Input
              id="o-reg"
              value={f.registrationNo}
              onChange={set('registrationNo')}
              placeholder="SEBI registration no."
            />
          </Field>
          <Field label="First admin name" htmlFor="o-an">
            <Input id="o-an" value={f.adminName} onChange={set('adminName')} />
          </Field>
          <Field label="First admin email" htmlFor="o-ae">
            <Input id="o-ae" type="email" value={f.adminEmail} onChange={set('adminEmail')} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Create organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
