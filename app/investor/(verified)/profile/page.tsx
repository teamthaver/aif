import { KycDetailView } from '@/components/kyc/kyc-detail-view';
import { PageHeader } from '@/components/shared/page-header';
import { pageData, requireVerifiedInvestor } from '@/lib/sessionCheck';
import { getOwnKycAction } from '@/lib/actions/kyc';

export default async function Page() {
  const ctx = await requireVerifiedInvestor();
  const detail = await pageData(getOwnKycAction());
  if (!detail) return null;
  return (
    <>
      <PageHeader
        title="My profile"
        description="Your verified details. To change them, ask your fund manager to start a fresh verification."
      />
      <KycDetailView detail={detail} />
    </>
  );
}
