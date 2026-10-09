import { InvestorsListView } from '@/components/kyc/investor-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listInvestorsAction } from '@/lib/actions/kyc';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePage('kyc:review', 'compliance_manager');
  return (
    <InvestorsListView
      title="KYC reviews"
      description="Applications waiting for review are listed first."
      investors={await pageData(listInvestorsAction(await searchParams))}
      basePath="/compliance/investors"
    />
  );
}
