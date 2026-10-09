import { Badge } from '@/components/ui/badge';
import { ROLE_LABEL } from '@/lib/rbac';
import type { KycStatus, Role } from '@/utils/types';

const KYC: Record<
  KycStatus,
  { label: string; v: 'success' | 'warning' | 'info' | 'destructive' | 'muted' }
> = {
  not_started: { label: 'Not started', v: 'muted' },
  in_progress: { label: 'In progress', v: 'info' },
  submitted: { label: 'Awaiting review', v: 'warning' },
  verified: { label: 'Verified', v: 'success' },
  rejected: { label: 'Needs changes', v: 'destructive' },
};
export const KycBadge = ({ status }: { status: KycStatus | null }) =>
  status ? (
    <Badge variant={KYC[status].v}>{KYC[status].label}</Badge>
  ) : (
    <span className="text-muted-foreground">–</span>
  );

const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'muted' | 'info'> = {
  active: 'success',
  invited: 'warning',
  suspended: 'destructive',
  open: 'success',
  draft: 'muted',
  closed: 'info',
  wound_up: 'muted',
  removed: 'muted',
};
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={TONE[status] ?? 'muted'}>
    {status.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())}
  </Badge>
);
export const RoleBadge = ({ role }: { role: Role }) => (
  <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
);
