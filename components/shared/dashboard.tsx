import { StatCard } from '@/components/shared/stat-card';
import { fmtMoney } from '@/lib/format';
import type { Role } from '@/utils/types';

type Stats = {
  roles: Record<string, number>;
  kyc: Record<string, number>;
  funds: Record<string, number>;
  committed: number;
};
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

// One overview, tuned per role: reviewers see their queue, auditors see the shape of the book.
export function OrgDashboard({ stats, role }: { stats: Stats; role: Role }) {
  const investors = sum(stats.kyc),
    verified = stats.kyc.verified ?? 0,
    pending = stats.kyc.submitted ?? 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {role === 'org_admin' && (
        <StatCard
          label="People"
          value={sum(stats.roles)}
          hint={`${stats.roles.investor ?? 0} investors`}
        />
      )}
      <StatCard
        label="Funds"
        value={sum(stats.funds)}
        hint={`${stats.funds.open ?? 0} open · ${stats.funds.draft ?? 0} draft`}
      />
      <StatCard label="Total committed" value={fmtMoney(stats.committed)} />
      <StatCard label="Investors" value={investors} hint={`${verified} verified`} />
      <StatCard
        label="KYC awaiting review"
        value={pending}
        hint={pending ? 'Needs a reviewer' : 'All caught up'}
      />
    </div>
  );
}
