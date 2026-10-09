import { StatusBadge } from '@/components/shared/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtMoney } from '@/lib/format';
import type { FundRow } from '@/utils/types';

export function FundSummary({ fund }: { fund: FundRow }) {
  const rows: [string, React.ReactNode][] = [
    ['Code', fund.code],
    ['Category', fund.category],
    ['Status', <StatusBadge key="s" status={fund.status} />],
    ['Strategy', fund.strategy ?? '–'],
    ['Target size', fmtMoney(fund.targetSize)],
    [
      'Committed',
      `${fmtMoney(fund.committed)} (${Math.round((fund.committed / fund.targetSize) * 100)}%)`,
    ],
    ['Minimum commitment', fmtMoney(fund.minCommitment)],
    ['Tenure', `${fund.tenureYears} years`],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-sm font-medium">{v}</div>
          </div>
        ))}
        {fund.description && (
          <div className="sm:col-span-2 lg:col-span-4">
            <div className="text-xs text-muted-foreground">Description</div>
            <p className="mt-0.5 text-sm">{fund.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
