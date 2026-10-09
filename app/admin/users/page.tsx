import Pagination from '@/components/paginationComponent';
import SearchComponent from '@/components/SearchComponent';
import { PageHeader } from '@/components/shared/page-header';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { UsersTable } from '@/components/users/users-table';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { CREATABLE_ROLES, MANAGEABLE_ROLES, ROLE_LABEL } from '@/lib/rbac';
import { listUsersAction } from '@/lib/actions/users';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePage('users:view', 'org_admin');
  const users = await pageData(listUsersAction(await searchParams));
  const roles = CREATABLE_ROLES.org_admin.map((r) => ({
    value: r as Exclude<typeof r, 'system_admin'>,
    label: ROLE_LABEL[r],
  }));
  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone in your organization. Create any kind of user; investors verify their KYC when they first sign in."
      >
        <CreateUserDialog roles={roles} />
      </PageHeader>
      <SearchComponent placeholder="Search by name or email" />
      <UsersTable users={users.rows} manageable={MANAGEABLE_ROLES.org_admin} meId={ctx.user.id} />
      <Pagination totalPages={users.totalPages} />
    </>
  );
}
