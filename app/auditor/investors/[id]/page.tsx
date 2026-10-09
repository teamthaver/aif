import { InvestorDetailView } from '@/components/kyc/investor-views';
import { pageData, requirePage } from '@/lib/sessionCheck';
import { getInvestorKycAction } from '@/lib/actions/kyc';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage('kyc:view', 'auditor');
  // an auditor gets the masked view
  const detail = await pageData(getInvestorKycAction({ investorId: (await params).id }));
  return <InvestorDetailView detail={detail} backTo="/auditor/investors" canReview={false} />;
}
