import { InvestorsListView } from '@/components/kyc/investor-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listInvestorsAction } from '@/lib/actions/kyc';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePage('investors:view', 'auditor');
  return (
    <InvestorsListView
      title="Investors"
      description="KYC status and commitments (view only)."
      investors={await pageData(listInvestorsAction(await searchParams))}
      basePath="/auditor/investors"
    />
  );
}
