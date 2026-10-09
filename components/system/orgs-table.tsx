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
import { fmtDay } from '@/lib/format';
import type { OrgRow } from '@/utils/types';
import { OrgActions } from './org-actions';

export function OrgsTable({ orgs }: { orgs: OrgRow[] }) {
  if (!orgs.length) return <EmptyState>No organizations yet. Create the first one.</EmptyState>;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Registration no.</TableHead>
            <TableHead className="text-right">People</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Link
                  href={`/system/organizations/${o.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {o.name}
                </Link>
              </TableCell>
              <TableCell>
                {o.type ?? <span className="text-muted-foreground">Not set yet</span>}
              </TableCell>
              <TableCell>{o.registrationNo ?? '–'}</TableCell>
              <TableCell className="text-right">{o.userCount}</TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell>{fmtDay(o.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <OrgActions org={o} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
