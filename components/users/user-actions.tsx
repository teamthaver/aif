'use client';
import { resendInviteAction, setUserStatusAction } from '@/lib/actions/users';
import { Button } from '@/components/ui/button';
import { showInviteLink } from '@/components/shared/invite-toast';
import { useRunner } from '@/components/shared/use-runner';
import type { UserStatus } from '@/utils/types';

export function UserActions({
  userId,
  name,
  email,
  status,
}: {
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
}) {
  const { run, busy } = useRunner();
  return (
    <div className="flex justify-end">
      {status === 'invited' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={async () => {
            const r = await run(() => resendInviteAction({ userId }), 'Invite sent again');
            if (r) showInviteLink(email, r.data.inviteToken);
          }}
        >
          Resend invite
        </Button>
      )}
      {status === 'active' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            confirm(`Suspend ${name}? They are signed out on their next click.`) &&
            run(() => setUserStatusAction({ userId, status: 'suspended' }), `${name} suspended`)
          }
        >
          Suspend
        </Button>
      )}
      {status === 'suspended' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(() => setUserStatusAction({ userId, status: 'active' }), `${name} reactivated`)
          }
        >
          Reactivate
        </Button>
      )}
    </div>
  );
}
