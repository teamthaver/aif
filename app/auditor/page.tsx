import { OrgDashboard } from '@/components/shared/dashboard';
import { PageHeader } from '@/components/shared/page-header';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { orgStatsAction } from '@/lib/actions/stats';

export default async function Page() {
  const ctx = await requirePage('funds:view', 'auditor');
  return (
    <>
      <PageHeader
        title="Auditor"
        description="Read-only view of funds, investors and the audit trail."
      />
      <OrgDashboard stats={await pageData(orgStatsAction())} role="auditor" />
    </>
  );
}
