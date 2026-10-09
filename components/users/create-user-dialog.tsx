'use client';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { createUserAction } from '@/lib/actions/users';
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
import { showInviteLink } from '@/components/shared/invite-toast';
import { useRunner } from '@/components/shared/use-runner';
import type { Role } from '@/utils/types';

type Creatable = Exclude<Role, 'system_admin'>;
// The server enforces who may create which role. This dialog only offers the roles the person is
// allowed to pick.
export function CreateUserDialog({
  roles,
  orgId,
  label = 'Create user',
  title = 'Create user',
  description,
}: {
  roles: { value: Creatable; label: string }[];
  orgId?: string;
  label?: string;
  title?: string;
  description?: string;
}) {
  const { run, busy } = useRunner();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ name: string; email: string; role: Creatable }>({
    name: '',
    email: '',
    role: roles[0].value,
  });

  async function submit() {
    const r = await run(() => createUserAction({ ...f, orgId }), 'Invite created');
    if (r) {
      setOpen(false);
      showInviteLink(f.email, r.data.inviteToken);
      setF({ name: '', email: '', role: roles[0].value });
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              'They receive a one-time link to set their password. Investors then complete KYC on first sign-in.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Full name" htmlFor="u-name">
            <Input
              id="u-name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="u-email">
            <Input
              id="u-email"
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </Field>
          {roles.length > 1 && (
            <Field label="Role">
              <Select
                value={f.role}
                onValueChange={(role) => setF({ ...f, role: role as Creatable })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
