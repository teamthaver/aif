import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { InvestorsTable } from '@/components/kyc/investors-table';
import { KycDetailView } from '@/components/kyc/kyc-detail-view';
import { KycReviewPanel } from '@/components/kyc/kyc-review-panel';
import { PageHeader } from '@/components/shared/page-header';
import Pagination from '@/components/paginationComponent';
import SearchComponent from '@/components/SearchComponent';
import type { InvestorRow, KycDetail, Paged } from '@/utils/types';

export function InvestorsListView({
  title,
  description,
  investors,
  basePath,
  actions,
  manageable,
}: {
  title: string;
  description?: string;
  investors: Paged<InvestorRow>;
  basePath: string;
  actions?: React.ReactNode;
  manageable?: boolean;
}) {
  return (
    <>
      <PageHeader title={title} description={description}>
        {actions}
      </PageHeader>
      <SearchComponent placeholder="Search by name or email" />
      <InvestorsTable investors={investors.rows} basePath={basePath} manageable={manageable} />
      <Pagination totalPages={investors.totalPages} />
    </>
  );
}

// canReview is true only for roles holding kyc:review. The review panel appears only while an
// application is waiting.
export function InvestorDetailView({
  detail,
  backTo,
  canReview,
}: {
  detail: KycDetail;
  backTo: string;
  canReview: boolean;
}) {
  return (
    <>
      <Link
        href={backTo}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <KycDetailView detail={detail} />
      {canReview && detail.status === 'submitted' && (
        <KycReviewPanel investorId={detail.investorId} backTo={backTo} />
      )}
    </>
  );
}
