import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { KycBadge } from '@/components/shared/badges';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DOC_LABEL } from '@/lib/kyc/rules';
import { fmtBytes, fmtDate } from '@/lib/format';
import type { AutoCheck, KycDetail } from '@/utils/types';
import { DocumentButton } from './document-button';

const ICON = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  fail: <XCircle className="size-4 text-destructive" />,
  warn: <AlertTriangle className="size-4 text-amber-600" />,
  skipped: <MinusCircle className="size-4 text-muted-foreground" />,
};
const Item = ({ k, v }: { k: string; v?: string }) => (
  <div>
    <div className="text-xs text-muted-foreground">{k}</div>
    <div className="mt-0.5 text-sm font-medium">{v || '–'}</div>
  </div>
);
const yn = (v: string) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '');

// Server-rendered, read-only. Documents and full identity numbers are only shown when the viewer is
// allowed (kyc:documents).
export function KycDetailView({ detail }: { detail: KycDetail }) {
  const f = detail.fields,
    full = detail.fullDetailsVisible;
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            {detail.name}
            <KycBadge status={detail.status} />
            {detail.submissionCount > 1 && (
              <Badge variant="muted">Submission {detail.submissionCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Item k="Email" v={detail.email} />
          <Item k="Account" v={detail.userStatus} />
          <Item k="Submitted" v={detail.submittedAt ? fmtDate(detail.submittedAt) : ''} />
          <Item
            k="Declaration signed"
            v={detail.declarationAt ? fmtDate(detail.declarationAt) : ''}
          />
          {detail.rejectionReason && (
            <div className="sm:col-span-2 lg:col-span-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <b>Sent back for changes:</b> {detail.rejectionReason}
            </div>
          )}
        </CardContent>
      </Card>

      {!full && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Your role sees a masked view: identity numbers are partly hidden, and personal details and
          documents are not shown.
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Item k="Legal name" v={f.legalName} />
            <Item k="PAN" v={f.panNumber} />
            {full && (
              <>
                <Item k="Date of birth" v={f.dob} />
                <Item k="Mobile" v={f.mobile} />
                <Item k="Aadhaar (last 4)" v={f.aadhaarLast4} />
              </>
            )}
            <Item k="Tax residency" v={f.taxResidency} />
            <Item k="Politically exposed" v={yn(f.isPep)} />
            <Item k="US person" v={yn(f.isUsPerson)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bank account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Item k="Holder name" v={f.bankHolder} />
            <Item k="Bank" v={f.bankName} />
            <Item k="Account number" v={f.bankAccountNumber} />
            <Item k="IFSC" v={f.bankIfsc} />
          </CardContent>
        </Card>
        {full && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Item k="Address" v={[f.addressLine1, f.addressLine2].filter(Boolean).join(', ')} />
                <Item k="City / State" v={[f.city, f.state].filter(Boolean).join(', ')} />
                <Item k="Pincode" v={f.pincode} />
                <Item k="Country" v={f.country} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Financial profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Item k="Occupation" v={f.occupation} />
                <Item k="Annual income" v={f.incomeRange} />
                <Item k="Source of funds" v={f.sourceOfFunds} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {detail.documents.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing uploaded.</p>
            )}
            {detail.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
              >
                <div>
                  <div className="font-medium">{DOC_LABEL[d.kind]}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.fileName} · {fmtBytes(d.sizeBytes)}
                  </div>
                </div>
                {full ? (
                  <DocumentButton documentId={d.id} label="Open" />
                ) : (
                  <Badge variant="muted">Restricted</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Automatic checks</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {detail.checks.length === 0 && (
              <p className="text-sm text-muted-foreground">Checks run when the investor submits.</p>
            )}
            {detail.checks.map((c: AutoCheck) => (
              <div key={c.key} className="flex items-start gap-2 text-sm">
                {ICON[c.status]}
                <div>
                  {c.label}
                  {c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}
                </div>
              </div>
            ))}
            {detail.checks.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Checks help the reviewer. They never verify anyone on their own.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {detail.reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review history</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {detail.reviews.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={r.decision === 'verified' ? 'success' : 'destructive'}>
                  {r.decision === 'verified' ? 'Verified' : 'Rejected'}
                </Badge>
                <span>by {r.reviewerName}</span>
                <span className="text-muted-foreground">{fmtDate(r.createdAt)}</span>
                {r.reason && <span className="text-muted-foreground">· {r.reason}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
