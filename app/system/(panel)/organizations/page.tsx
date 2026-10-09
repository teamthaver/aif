import { CreateOrgDialog } from '@/components/system/create-org-dialog';
import { OrgsTable } from '@/components/system/orgs-table';
import { PageHeader } from '@/components/shared/page-header';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listOrgsAction } from '@/lib/actions/organizations';

export default async function Page() {
  const ctx = await requirePage('organizations:view', 'system_admin');
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Create an organization and invite its first admin. The admin builds the rest of the team."
      >
        <CreateOrgDialog />
      </PageHeader>
      <OrgsTable orgs={await pageData(listOrgsAction())} />
    </>
  );
}
