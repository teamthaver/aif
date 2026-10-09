import { InvestorsListView } from '@/components/kyc/investor-views';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listInvestorsAction } from '@/lib/actions/kyc';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePage('investors:view', 'fund_manager');
  return (
    <InvestorsListView
      title="Investors"
      description="Create investors. They verify their KYC on first sign-in, then you can assign them to funds."
      investors={await pageData(listInvestorsAction(await searchParams))}
      basePath="/manager/investors"
      manageable
      actions={
        <CreateUserDialog
          roles={[{ value: 'investor', label: 'Investor' }]}
          label="Create investor"
          title="Create an investor"
        />
      }
    />
  );
}
