import { FundDetailView } from '@/components/funds/fund-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { getFundAction, listAssignableInvestorsAction } from '@/lib/actions/funds';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage('funds:edit', 'fund_manager');
  const data = await pageData(getFundAction({ id: (await params).id }));
  return (
    <FundDetailView
      fund={data.fund}
      assignments={data.assignments}
      investorBase="/manager/investors"
      manage={{
        assignable: await pageData(listAssignableInvestorsAction({ fundId: data.fund.id })),
      }}
    />
  );
}
