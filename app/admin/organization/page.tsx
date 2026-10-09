import { OrgProfileForm } from '@/components/admin/org-profile-form';
import { PageHeader } from '@/components/shared/page-header';
import { listOrgsAction } from '@/lib/actions/organizations';
import { pageData, requirePage } from '@/lib/sessionCheck';

export default async function Page() {
  await requirePage('organizations:profile', 'org_admin');
  // for an org admin this is their own organization only
  const [org] = await pageData(listOrgsAction());
  return (
    <>
      <PageHeader
        title="Organization"
        description="Tell us what kind of organization this is. You choose this yourself."
      />
      <OrgProfileForm name={org.name} type={org.type} registrationNo={org.registrationNo} />
    </>
  );
}
