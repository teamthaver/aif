import Link from 'next/link';
import { StatusBadge } from '@/components/shared/badges';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtDay, fmtMoney } from '@/lib/format';
import type { AssignmentRow } from '@/utils/types';
import { AssignmentActions } from './assignment-actions';

// editable = the viewer is a fund manager and the fund still accepts changes. investorBase links to
// the viewer's own investor page.
export function AssignmentsTable({
  assignments,
  investorBase,
  editable,
}: {
  assignments: AssignmentRow[];
  investorBase: string;
  editable: boolean;
}) {
  if (!assignments.length) return <EmptyState>No investors assigned yet.</EmptyState>;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Investor</TableHead>
            <TableHead className="text-right">Commitment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Confirmed by investor</TableHead>
            <TableHead>Notes</TableHead>
            {editable && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow key={a.id} className={a.status === 'removed' ? 'opacity-60' : ''}>
              <TableCell>
                <Link
                  href={`${investorBase}/${a.investorId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {a.investorName}
                </Link>
                <div className="text-xs text-muted-foreground">{a.investorEmail}</div>
              </TableCell>
              <TableCell className="text-right">{fmtMoney(a.commitmentAmount)}</TableCell>
              <TableCell>
                <StatusBadge status={a.status} />
              </TableCell>
              <TableCell>
                {a.status === 'removed' ? (
                  '–'
                ) : a.acceptedAt ? (
                  <Badge variant="success">Confirmed {fmtDay(a.acceptedAt)}</Badge>
                ) : (
                  <Badge variant="warning">Awaiting</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {a.notes ?? '–'}
              </TableCell>
              {editable && (
                <TableCell>
                  <AssignmentActions a={a} editable />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
