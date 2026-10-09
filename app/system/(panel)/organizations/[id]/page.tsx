import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { UsersTable } from '@/components/users/users-table';
import { StatusBadge } from '@/components/shared/badges';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { MANAGEABLE_ROLES, ROLE_LABEL, ORG_ROLES } from '@/lib/rbac';
import { getOrgAction } from '@/lib/actions/organizations';
import { listUsersAction } from '@/lib/actions/users';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage('organizations:view', 'system_admin');
  const { org, roleCounts: counts } = await pageData(getOrgAction({ id: (await params).id }));
  const admins = (
    await pageData(listUsersAction({ orgId: org.id, roles: ['org_admin'], limit: 100 }))
  ).rows;
  return (
    <>
      <PageHeader
        title={org.name}
        description={`${org.type ?? 'Type not set yet (the organization chooses it)'}${org.registrationNo ? ` · ${org.registrationNo}` : ''}`}
      >
        <StatusBadge status={org.status} />
        {org.status === 'active' && (
          <CreateUserDialog
            roles={[{ value: 'org_admin', label: ROLE_LABEL.org_admin }]}
            orgId={org.id}
            label="Add organization admin"
            title="Add an organization admin"
            description="Organization admins create everyone else in this organization."
          />
        )}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ORG_ROLES.map((r) => (
          <StatCard key={r} label={ROLE_LABEL[r]} value={counts[r] ?? 0} />
        ))}
      </div>
      <PageHeader
        title="Organization admins"
        description="The system admin manages only these accounts. Everything else belongs to the organization."
      />
      <UsersTable users={admins} manageable={MANAGEABLE_ROLES.system_admin} meId={ctx.user.id} />
    </>
  );
}
