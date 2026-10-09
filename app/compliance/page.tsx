import Link from 'next/link';
import { OrgDashboard } from '@/components/shared/dashboard';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { orgStatsAction } from '@/lib/actions/stats';

export default async function Page() {
  const ctx = await requirePage('kyc:review', 'compliance_manager');
  return (
    <>
      <PageHeader
        title="Compliance"
        description="Verify investors before they can use their account."
      >
        <Button asChild>
          <Link href="/compliance/kyc">Open KYC reviews</Link>
        </Button>
      </PageHeader>
      <OrgDashboard stats={await pageData(orgStatsAction())} role="compliance_manager" />
    </>
  );
}
