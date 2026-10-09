import { OrgDashboard } from '@/components/shared/dashboard';
import { PageHeader } from '@/components/shared/page-header';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { orgStatsAction } from '@/lib/actions/stats';

export default async function Page() {
  const ctx = await requirePage('funds:view', 'fund_manager');
  return (
    <>
      <PageHeader
        title="Fund manager"
        description="Create funds, create and verify investors, and assign them to funds."
      />
      <OrgDashboard stats={await pageData(orgStatsAction())} role="fund_manager" />
    </>
  );
}
