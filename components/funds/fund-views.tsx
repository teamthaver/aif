import { PageHeader } from '@/components/shared/page-header';
import { FundFormDialog } from '@/components/funds/fund-form-dialog';
import { FundStatusButtons } from '@/components/funds/fund-status-buttons';
import { AssignInvestorDialog } from '@/components/funds/assign-investor-dialog';
import { AssignmentsTable } from '@/components/funds/assignments-table';
import { FundsTable } from '@/components/funds/funds-table';
import { FundSummary } from '@/components/funds/fund-summary';
import Pagination from '@/components/paginationComponent';
import SearchComponent from '@/components/SearchComponent';
import type { AssignmentRow, FundRow, InvestorOption, Paged } from '@/utils/types';

// Read-only list. Only the fund manager's page passes `actions`, so only they get a "New fund"
// button.
export function FundsListView({
  funds,
  basePath,
  actions,
}: {
  funds: Paged<FundRow>;
  basePath: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Funds"
        description={
          actions ? 'Create and run your funds' : 'Funds in your organization (view only)'
        }
      >
        {actions}
      </PageHeader>
      <SearchComponent placeholder="Search by name or code" />
      <FundsTable funds={funds.rows} basePath={basePath} />
      <Pagination totalPages={funds.totalPages} />
    </>
  );
}

// manage is passed only by the fund manager's page: it adds editing, status changes and assigning
// investors.
export function FundDetailView({
  fund,
  assignments,
  investorBase,
  manage,
}: {
  fund: FundRow;
  assignments: AssignmentRow[];
  investorBase: string;
  manage?: { assignable: InvestorOption[] };
}) {
  const open = fund.status === 'draft' || fund.status === 'open';
  return (
    <>
      <PageHeader title={fund.name} description={`${fund.code} · ${fund.category}`}>
        {manage && (
          <>
            <FundStatusButtons fundId={fund.id} status={fund.status} />
            {fund.status !== 'wound_up' && <FundFormDialog fund={fund} />}
          </>
        )}
      </PageHeader>
      <FundSummary fund={fund} />
      <PageHeader
        title="Investors"
        description={manage ? 'Only investors with verified KYC can be assigned.' : undefined}
      >
        {manage && open && (
          <AssignInvestorDialog
            fundId={fund.id}
            investors={manage.assignable}
            minCommitment={fund.minCommitment}
          />
        )}
      </PageHeader>
      <AssignmentsTable
        assignments={assignments}
        investorBase={investorBase}
        editable={!!manage && open}
      />
    </>
  );
}
