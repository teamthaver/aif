import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { pageData, requireVerifiedInvestor } from '@/lib/sessionCheck';
import { fmtMoney } from '@/lib/format';
import { investorSummaryAction } from '@/lib/actions/stats';

export default async function Page() {
  const ctx = await requireVerifiedInvestor();
  const s = await pageData(investorSummaryAction());
  return (
    <>
      <PageHeader
        title={`Welcome, ${ctx.user.name.split(' ')[0]}`}
        description="Your funds and commitments."
      >
        <Button asChild>
          <Link href="/investor/funds">View my funds</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Funds" value={s.funds} />
        <StatCard label="Total commitment" value={fmtMoney(s.committed)} />
        <StatCard
          label="Awaiting your confirmation"
          value={s.awaitingConfirmation}
          hint={s.awaitingConfirmation ? 'Open My funds to confirm' : 'Nothing to do'}
        />
      </div>
    </>
  );
}
