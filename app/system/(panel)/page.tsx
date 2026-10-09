import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { platformStatsAction } from '@/lib/actions/stats';

export default async function Page() {
  await requirePage('organizations:view', 'system_admin');
  const s = await pageData(platformStatsAction());
  return (
    <>
      <PageHeader title="Platform overview" description="Organizations and the people in them">
        <Button asChild>
          <Link href="/system/organizations">Manage organizations</Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active organizations" value={s.activeOrgs} />
        <StatCard label="Suspended organizations" value={s.suspendedOrgs} />
        <StatCard label="People across organizations" value={s.users} />
      </div>
    </>
  );
}
