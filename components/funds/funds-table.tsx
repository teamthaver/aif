import Link from 'next/link';
import { StatusBadge } from '@/components/shared/badges';
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
import { fmtMoney } from '@/lib/format';
import type { FundRow } from '@/utils/types';

// Static, server-rendered. Each role passes its own base path, so a link never leaves that role's
// panel.
export function FundsTable({ funds, basePath }: { funds: FundRow[]; basePath: string }) {
  if (!funds.length) return <EmptyState>No funds yet.</EmptyState>;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fund</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="text-right">Committed</TableHead>
            <TableHead className="text-right">Investors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {funds.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Link
                  href={`${basePath}/${f.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {f.name}
                </Link>
                <div className="text-xs text-muted-foreground">{f.code}</div>
              </TableCell>
              <TableCell>{f.category}</TableCell>
              <TableCell>
                <StatusBadge status={f.status} />
              </TableCell>
              <TableCell className="text-right">{fmtMoney(f.targetSize)}</TableCell>
              <TableCell className="text-right">
                {fmtMoney(f.committed)}
                <div className="text-xs text-muted-foreground">
                  {Math.round((f.committed / f.targetSize) * 100)}% of target
                </div>
              </TableCell>
              <TableCell className="text-right">{f.investorCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
