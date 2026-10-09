import { KycBadge, RoleBadge, StatusBadge } from '@/components/shared/badges';
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
import { fmtDate } from '@/lib/format';
import type { Role, UserRow } from '@/utils/types';
import { UserActions } from './user-actions';

// manageable = roles the viewer may suspend/reactivate/re-invite (from the RBAC matrix). Everyone
// else is read-only.
export function UsersTable({
  users,
  manageable,
  meId,
}: {
  users: UserRow[];
  manageable: Role[];
  meId: string;
}) {
  if (!users.length) return <EmptyState>No users yet.</EmptyState>;
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>KYC</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">
                  {u.name}
                  {u.id === meId && ' (you)'}
                </div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </TableCell>
              <TableCell>
                <RoleBadge role={u.role} />
              </TableCell>
              <TableCell>
                <StatusBadge status={u.status} />
              </TableCell>
              <TableCell>
                {u.role === 'investor' ? (
                  <KycBadge status={u.kycStatus} />
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {fmtDate(u.lastLoginAt)}
              </TableCell>
              <TableCell>
                {manageable.includes(u.role) && u.id !== meId && (
                  <UserActions userId={u.id} name={u.name} email={u.email} status={u.status} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
