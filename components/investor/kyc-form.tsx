'use client';
import { CheckCircle2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { saveKycDraftAction, submitKycAction, uploadKycDocumentAction } from '@/lib/actions/kyc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { fmtBytes } from '@/lib/format';
import {
  DOC_LABEL,
  INCOME_RANGES,
  OCCUPATIONS,
  REQUIRED_DOCS,
  SOURCES_OF_FUNDS,
} from '@/lib/kyc/rules';
import type { KycDetail, KycDocKind, KycFields } from '@/utils/types';
import { DocumentButton } from '@/components/kyc/document-button';

const MAX = 3 * 1024 * 1024;

function Pick({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const v = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <SelectItem key={v.value} value={v.value}>
              {v.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
const YES_NO = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

export function KycForm({ detail }: { detail: KycDetail }) {
  const { run, busy } = useRunner();
  const [f, setF] = useState<KycFields>(detail.fields);
  const [declared, setDeclared] = useState(false);
  const readOnly = !['not_started', 'in_progress', 'rejected'].includes(detail.status);
  const set = (k: keyof KycFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const pick = (k: keyof KycFields) => (v: string) => setF({ ...f, [k]: v } as KycFields);
  const docOf = (k: KycDocKind) => detail.documents.find((d) => d.kind === k);
  const lock = { disabled: readOnly };

  async function save(msg = 'Draft saved') {
    return run(() => saveKycDraftAction(f), msg);
  }
  async function submit() {
    if (!declared) return toast.error('Tick the declaration to submit.');
    if (!(await save('Saved'))) return;
    await run(
      () => submitKycAction({ declaration: true }),
      'Submitted for verification. We will let you know the outcome.',
    );
  }
  async function upload(kind: KycDocKind, file?: File) {
    if (!file) return;
    if (file.size > MAX) return toast.error('Files must be 3 MB or smaller.');
    const fd = new FormData();
    fd.set('kind', kind);
    fd.set('file', file);
    await run(() => uploadKycDocumentAction(fd), `${DOC_LABEL[kind].split(' (')[0]} uploaded`);
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Personal details</CardTitle>
          <CardDescription>Exactly as they appear on your PAN card.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="k-name" className="sm:col-span-2">
            <Input id="k-name" value={f.legalName} onChange={set('legalName')} {...lock} />
          </Field>
          <Field label="Date of birth" htmlFor="k-dob">
            <Input id="k-dob" type="date" value={f.dob} onChange={set('dob')} {...lock} />
          </Field>
          <Field label="Mobile number" htmlFor="k-mob">
            <Input
              id="k-mob"
              inputMode="numeric"
              maxLength={10}
              value={f.mobile}
              onChange={set('mobile')}
              {...lock}
            />
          </Field>
          <Field label="PAN" htmlFor="k-pan" hint="Individual PAN, e.g. ABCPE1234F">
            <Input
              id="k-pan"
              value={f.panNumber}
              maxLength={10}
              className="uppercase"
              onChange={(e) => setF({ ...f, panNumber: e.target.value.toUpperCase() })}
              {...lock}
            />
          </Field>
          <Field
            label="Aadhaar: last 4 digits"
            htmlFor="k-aad"
            hint="We never ask for or store your full Aadhaar number."
          >
            <Input
              id="k-aad"
              inputMode="numeric"
              maxLength={4}
              value={f.aadhaarLast4}
              onChange={set('aadhaarLast4')}
              {...lock}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="k-a1" className="sm:col-span-2">
            <Input id="k-a1" value={f.addressLine1} onChange={set('addressLine1')} {...lock} />
          </Field>
          <Field label="Address line 2" htmlFor="k-a2" className="sm:col-span-2">
            <Input id="k-a2" value={f.addressLine2} onChange={set('addressLine2')} {...lock} />
          </Field>
          <Field label="City" htmlFor="k-city">
            <Input id="k-city" value={f.city} onChange={set('city')} {...lock} />
          </Field>
          <Field label="State" htmlFor="k-state">
            <Input id="k-state" value={f.state} onChange={set('state')} {...lock} />
          </Field>
          <Field label="Pincode" htmlFor="k-pin">
            <Input
              id="k-pin"
              inputMode="numeric"
              maxLength={6}
              value={f.pincode}
              onChange={set('pincode')}
              {...lock}
            />
          </Field>
          <Field label="Country" htmlFor="k-country">
            <Input id="k-country" value={f.country} onChange={set('country')} {...lock} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Financial profile and declarations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Occupation">
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <Pick
                value={f.occupation}
                onChange={pick('occupation')}
                options={OCCUPATIONS}
                placeholder="Select"
              />
            </div>
          </Field>
          <Field label="Annual income">
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <Pick
                value={f.incomeRange}
                onChange={pick('incomeRange')}
                options={INCOME_RANGES}
                placeholder="Select"
              />
            </div>
          </Field>
          <Field label="Source of funds">
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <Pick
                value={f.sourceOfFunds}
                onChange={pick('sourceOfFunds')}
                options={SOURCES_OF_FUNDS}
                placeholder="Select"
              />
            </div>
          </Field>
          <Field label="Country of tax residency" htmlFor="k-tax">
            <Input id="k-tax" value={f.taxResidency} onChange={set('taxResidency')} {...lock} />
          </Field>
          <Field label="Are you, or are you related to, a politically exposed person?">
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <Pick
                value={f.isPep}
                onChange={pick('isPep')}
                options={YES_NO}
                placeholder="Select"
              />
            </div>
          </Field>
          <Field label="Are you a US citizen or US tax resident?">
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <Pick
                value={f.isUsPerson}
                onChange={pick('isUsPerson')}
                options={YES_NO}
                placeholder="Select"
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Bank account</CardTitle>
          <CardDescription>
            The account your investments are paid from and returns are paid to. It must be in your
            own name.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder name" htmlFor="k-bh">
            <Input id="k-bh" value={f.bankHolder} onChange={set('bankHolder')} {...lock} />
          </Field>
          <Field label="Bank name" htmlFor="k-bn">
            <Input id="k-bn" value={f.bankName} onChange={set('bankName')} {...lock} />
          </Field>
          <Field label="Account number" htmlFor="k-ac">
            <Input
              id="k-ac"
              inputMode="numeric"
              maxLength={18}
              value={f.bankAccountNumber}
              onChange={set('bankAccountNumber')}
              {...lock}
            />
          </Field>
          <Field label="IFSC" htmlFor="k-ifsc">
            <Input
              id="k-ifsc"
              maxLength={11}
              className="uppercase"
              value={f.bankIfsc}
              onChange={(e) => setF({ ...f, bankIfsc: e.target.value.toUpperCase() })}
              {...lock}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Documents</CardTitle>
          <CardDescription>
            PDF, JPG or PNG, up to 3 MB each. Uploading again replaces the earlier file.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {REQUIRED_DOCS.map((k) => {
            const d = docOf(k);
            return (
              <div
                key={k}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  {d ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Upload className="size-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">{DOC_LABEL[k]}</div>
                    <div className="text-xs text-muted-foreground">
                      {d ? `${d.fileName} · ${fmtBytes(d.sizeBytes)}` : 'Not uploaded'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d && <DocumentButton documentId={d.id} label="View" />}
                  {!readOnly && (
                    <Input
                      type="file"
                      className="w-64"
                      accept={
                        k === 'photo'
                          ? 'image/jpeg,image/png'
                          : 'application/pdf,image/jpeg,image/png'
                      }
                      disabled={busy}
                      onChange={(e) => {
                        upload(k, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardContent className="grid gap-4 pt-5">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={declared}
                onCheckedChange={(v) => setDeclared(v === true)}
                className="mt-0.5"
              />
              <span>
                I declare that the information and documents I have provided are true and complete,
                and I consent to them being verified. I understand that providing false information
                may lead to my account being closed.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => save()}>
                Save draft
              </Button>
              <Button disabled={busy || !declared} onClick={submit}>
                Submit for verification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
