import { AcceptCommitmentButton } from '@/components/investor/accept-commitment-button';
import { StatusBadge } from '@/components/shared/badges';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { pageData, requireVerifiedInvestor } from '@/lib/sessionCheck';
import { fmtDay, fmtMoney } from '@/lib/format';
import { listMyFundsAction } from '@/lib/actions/funds';

export default async function Page() {
  const ctx = await requireVerifiedInvestor();
  const funds = await pageData(listMyFundsAction());
  return (
    <>
      <PageHeader title="My funds" description="Funds your fund manager has assigned to you." />
      {funds.length === 0 && <EmptyState>No funds have been assigned to you yet.</EmptyState>}
      <div className="grid gap-4 lg:grid-cols-2">
        {funds.map((f) => (
          <Card key={f.assignmentId}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {f.name}
                <StatusBadge status={f.status} />
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {f.code} · {f.category}
                {f.strategy ? ` · ${f.strategy}` : ''}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {f.description && <p className="text-sm">{f.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Your commitment</div>
                  <div className="text-lg font-semibold">
                    {fmtMoney(f.commitmentAmount, f.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tenure</div>
                  <div className="text-lg font-semibold">{f.tenureYears} years</div>
                </div>
              </div>
              {f.acceptedAt ? (
                <Badge variant="success" className="w-fit">
                  Confirmed on {fmtDay(f.acceptedAt)}
                </Badge>
              ) : f.status === 'open' ? (
                <div>
                  <AcceptCommitmentButton assignmentId={f.assignmentId} />
                </div>
              ) : (
                <Badge variant="muted" className="w-fit">
                  This fund is not open for confirmations
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
