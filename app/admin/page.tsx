import Link from 'next/link';
import { OrgDashboard } from '@/components/shared/dashboard';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { listOrgsAction } from '@/lib/actions/organizations';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { orgStatsAction } from '@/lib/actions/stats';

export default async function Page() {
  const ctx = await requirePage('users:view', 'org_admin');
  const [org] = await pageData(listOrgsAction());
  return (
    <>
      <PageHeader
        title={ctx.org!.name}
        description="Everything in your organization at a glance. You can see all of it and create any kind of user; funds are run by your fund managers."
      />
      {!org.type && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Your organization's type is not set yet.{' '}
          <Link href="/admin/organization" className="font-medium underline">
            Choose it now
          </Link>
          .
        </Card>
      )}
      <OrgDashboard stats={await pageData(orgStatsAction())} role="org_admin" />
    </>
  );
}
