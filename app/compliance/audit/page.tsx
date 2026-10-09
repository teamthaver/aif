import { AuditFeed } from '@/components/audit/audit-feed';
import { PageHeader } from '@/components/shared/page-header';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listAuditAction } from '@/lib/actions/audit';

export default async function Page() {
  const ctx = await requirePage('audit:view', 'compliance_manager');
  const first = await pageData(listAuditAction());
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change in your organization, newest first."
      />
      <AuditFeed initial={first.entries} initialNext={first.nextBefore} showOrg={false} />
    </>
  );
}
