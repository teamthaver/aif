'use client';
import { acceptCommitmentAction } from '@/lib/actions/funds';
import { Button } from '@/components/ui/button';
import { useRunner } from '@/components/shared/use-runner';

export function AcceptCommitmentButton({ assignmentId }: { assignmentId: string }) {
  const { run, busy } = useRunner();
  return (
    <Button
      disabled={busy}
      onClick={() => run(() => acceptCommitmentAction({ assignmentId }), 'Commitment confirmed')}
    >
      Confirm my commitment
    </Button>
  );
}
