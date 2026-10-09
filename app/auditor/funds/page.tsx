import { FundsListView } from '@/components/funds/fund-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { listFundsAction } from '@/lib/actions/funds';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePage('funds:view', 'auditor');
  return (
    <FundsListView
      funds={await pageData(listFundsAction(await searchParams))}
      basePath="/auditor/funds"
    />
  );
}
