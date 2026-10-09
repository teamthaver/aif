'use client';
import { useState } from 'react';
import { listAuditAction } from '@/lib/actions/audit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRunner } from '@/components/shared/use-runner';
import { fmtDate } from '@/lib/format';
import type { AuditRow } from '@/utils/types';

type Obj = Record<string, unknown> | null;
function summary(e: AuditRow) {
  const a = e.after as Obj,
    b = e.before as Obj;
  if (e.action === 'user.status' || e.action === 'org.status') return `${b?.status} → ${a?.status}`;
  if (e.action === 'user.create') return `${a?.email} as ${String(a?.role).replace('_', ' ')}`;
  if (e.action.startsWith('fund.') && a?.fund)
    return `${a.fund} · ${a.investor ?? ''}${a.commitment ? ` · ₹${Number(a.commitment).toLocaleString('en-IN')}` : ''}`;
  if (e.action === 'fund.create' || e.action === 'org.create') return `${a?.name ?? ''}`;
  if (e.action === 'kyc.reject') return String(a?.reason ?? '');
  if (e.action === 'kyc.upload_document' || e.action === 'kyc.view_document')
    return String(a?.kind ?? '').replace('_', ' ');
  return '';
}

// First page arrives from the server; "Load more" asks a Server Action for the next page.
export function AuditFeed({
  initial,
  initialNext,
  showOrg,
}: {
  initial: AuditRow[];
  initialNext: number | null;
  showOrg: boolean;
}) {
  const { run, busy } = useRunner();
  const [rows, setRows] = useState(initial);
  const [next, setNext] = useState(initialNext);
  async function more() {
    if (!next) return;
    const r = await run(() => listAuditAction({ before: next }));
    if (r) {
      setRows((x) => [...x, ...r.data.entries]);
      setNext(r.data.nextBefore);
    }
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            {showOrg && <TableHead>Organization</TableHead>}
            <TableHead>Action</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {fmtDate(e.at)}
              </TableCell>
              <TableCell>{e.actorName ?? 'System'}</TableCell>
              {showOrg && <TableCell>{e.orgName ?? '–'}</TableCell>}
              <TableCell>
                <Badge variant="muted" className="font-mono">
                  {e.action}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{summary(e)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Nothing recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {next && (
        <div className="p-4">
          <Button variant="outline" onClick={more} disabled={busy}>
            Load more
          </Button>
        </div>
      )}
    </Card>
  );
}
