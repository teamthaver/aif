import Link from 'next/link';
import { KycBadge, StatusBadge } from '@/components/shared/badges';
import { EmptyState } from '@/components/shared/empty-state';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserActions } from '@/components/users/user-actions';
import { fmtDay, fmtMoney } from '@/lib/format';
import type { InvestorRow } from '@/utils/types';

// manageable = the viewer may resend invites and suspend/reactivate investors (the fund manager and
// org admin)
export function InvestorsTable({
  investors,
  basePath,
  manageable = false,
}: {
  investors: InvestorRow[];
  basePath: string;
  manageable?: boolean;
}) {
  if (!investors.length) return <EmptyState>No investors here.</EmptyState>;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Investor</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Funds</TableHead>
            <TableHead className="text-right">Committed</TableHead>
            {manageable && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {investors.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Link
                  href={`${basePath}/${i.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {i.name}
                </Link>
                <div className="text-xs text-muted-foreground">{i.email}</div>
              </TableCell>
              <TableCell>
                <StatusBadge status={i.userStatus} />
              </TableCell>
              <TableCell>
                <KycBadge status={i.kycStatus} />
              </TableCell>
              <TableCell>{fmtDay(i.submittedAt)}</TableCell>
              <TableCell className="text-right">{i.fundCount}</TableCell>
              <TableCell className="text-right">{fmtMoney(i.committed)}</TableCell>
              {manageable && (
                <TableCell>
                  <UserActions
                    userId={i.id}
                    name={i.name}
                    email={i.email}
                    status={i.userStatus as 'invited' | 'active' | 'suspended'}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
