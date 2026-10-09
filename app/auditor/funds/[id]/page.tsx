import { FundDetailView } from '@/components/funds/fund-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { getFundAction } from '@/lib/actions/funds';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage('funds:view', 'auditor');
  const data = await pageData(getFundAction({ id: (await params).id }));
  return (
    <FundDetailView
      fund={data.fund}
      assignments={data.assignments}
      investorBase="/auditor/investors"
    />
  );
}
