'use client';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { createFundAction, updateFundAction } from '@/lib/actions/funds';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/field';
import { useRunner } from '@/components/shared/use-runner';
import type { FundCategory, FundRow } from '@/utils/types';

const CATEGORIES: FundCategory[] = ['Category I', 'Category II', 'Category III'];
const toForm = (f?: FundRow) => ({
  code: f?.code ?? '',
  name: f?.name ?? '',
  category: (f?.category ?? 'Category II') as FundCategory,
  strategy: f?.strategy ?? '',
  description: f?.description ?? '',
  targetSize: f ? String(f.targetSize) : '',
  minCommitment: f ? String(f.minCommitment) : '',
  tenureYears: f ? String(f.tenureYears) : '8',
});

export function FundFormDialog({ fund }: { fund?: FundRow }) {
  const { run, busy } = useRunner();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(toForm(fund));
  const set =
    (k: keyof ReturnType<typeof toForm>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function submit() {
    const body = {
      ...f,
      targetSize: Number(f.targetSize),
      minCommitment: Number(f.minCommitment),
      tenureYears: Number(f.tenureYears),
    };
    const r = fund
      ? await run(() => updateFundAction({ id: fund.id, ...body }), 'Fund updated')
      : await run(() => createFundAction(body), 'Fund created');
    if (r) {
      setOpen(false);
      if (!fund) setF(toForm());
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF(toForm(fund));
      }}
    >
      <DialogTrigger asChild>
        {fund ? (
          <Button variant="outline">
            <Pencil />
            Edit fund
          </Button>
        ) : (
          <Button>
            <Plus />
            New fund
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fund ? `Edit ${fund.name}` : 'New fund'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fund name" htmlFor="f-name" className="sm:col-span-2">
            <Input id="f-name" value={f.name} onChange={set('name')} />
          </Field>
          <Field label="Code" htmlFor="f-code" hint="Short unique code, e.g. CGF-1">
            <Input id="f-code" value={f.code} onChange={set('code')} className="uppercase" />
          </Field>
          <Field label="SEBI category">
            <Select
              value={f.category}
              onValueChange={(category) => setF({ ...f, category: category as FundCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target size (₹)" htmlFor="f-target">
            <Input
              id="f-target"
              type="number"
              min="0"
              value={f.targetSize}
              onChange={set('targetSize')}
            />
          </Field>
          <Field label="Minimum commitment (₹)" htmlFor="f-min">
            <Input
              id="f-min"
              type="number"
              min="0"
              value={f.minCommitment}
              onChange={set('minCommitment')}
            />
          </Field>
          <Field label="Tenure (years)" htmlFor="f-tenure">
            <Input
              id="f-tenure"
              type="number"
              min="1"
              max="30"
              value={f.tenureYears}
              onChange={set('tenureYears')}
            />
          </Field>
          <Field label="Strategy" htmlFor="f-strategy">
            <Input
              id="f-strategy"
              value={f.strategy}
              onChange={set('strategy')}
              placeholder="e.g. Growth equity"
            />
          </Field>
          <Field label="Description" htmlFor="f-desc" className="sm:col-span-2">
            <Textarea id="f-desc" value={f.description} onChange={set('description')} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {fund ? 'Save changes' : 'Create fund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
