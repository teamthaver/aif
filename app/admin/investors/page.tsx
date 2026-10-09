import { InvestorsListView } from '@/components/kyc/investor-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listInvestorsAction } from '@/lib/actions/kyc';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePage('investors:view', 'org_admin');
  return (
    <InvestorsListView
      title="Investors"
      description="KYC status and commitments for every investor (view only)."
      investors={await pageData(listInvestorsAction(await searchParams))}
      basePath="/admin/investors"
    />
  );
}
