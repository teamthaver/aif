'use client';
import { useState } from 'react';
import { updateOwnOrgAction } from '@/lib/actions/organizations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ORG_TYPES, type OrgTypeOption } from '@/lib/org-types';

// The organization chooses its own type here. The server applies it to the caller's own
// organization only.
export function OrgProfileForm({
  name,
  type,
  registrationNo,
}: {
  name: string;
  type: OrgTypeOption | null;
  registrationNo: string | null;
}) {
  const { run, busy } = useRunner();
  const [f, setF] = useState<{ type: OrgTypeOption | ''; registrationNo: string }>({
    type: type ?? '',
    registrationNo: registrationNo ?? '',
  });
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Organization details</CardTitle>
        <CardDescription>
          These describe {name}. Only organization admins can change them.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field
          label="Organization name"
          htmlFor="p-name"
          hint="The name is set by the platform administrator."
        >
          <Input id="p-name" value={name} disabled />
        </Field>
        <Field label="Organization type">
          <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as OrgTypeOption })}>
            <SelectTrigger>
              <SelectValue placeholder="Choose your organization type" />
            </SelectTrigger>
            <SelectContent>
              {ORG_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Registration number" htmlFor="p-reg">
          <Input
            id="p-reg"
            value={f.registrationNo}
            onChange={(e) => setF({ ...f, registrationNo: e.target.value })}
            placeholder="SEBI registration no."
          />
        </Field>
        <div>
          <Button
            disabled={busy || !f.type}
            onClick={() =>
              run(
                () =>
                  updateOwnOrgAction({
                    type: f.type as OrgTypeOption,
                    registrationNo: f.registrationNo,
                  }),
                'Organization details saved',
              )
            }
          >
            Save details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
