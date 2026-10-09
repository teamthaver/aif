import { AuditFeed } from '@/components/audit/audit-feed';
import { VerifyChainButton } from '@/components/system/verify-chain-button';
import { PageHeader } from '@/components/shared/page-header';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listAuditAction } from '@/lib/actions/audit';

export default async function Page() {
  const ctx = await requirePage('audit:view', 'system_admin');
  const first = await pageData(listAuditAction());
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change on the platform, newest first. Entries cannot be edited or removed."
      >
        <VerifyChainButton />
      </PageHeader>
      <AuditFeed initial={first.entries} initialNext={first.nextBefore} showOrg />
    </>
  );
}
