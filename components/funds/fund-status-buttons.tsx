'use client';
import { setFundStatusAction } from '@/lib/actions/funds';
import { Button } from '@/components/ui/button';
import { useRunner } from '@/components/shared/use-runner';
import type { FundStatus } from '@/utils/types';

const MOVES: Record<
  FundStatus,
  { to: FundStatus; label: string; variant?: 'default' | 'outline' }[]
> = {
  draft: [{ to: 'open', label: 'Open for investors' }],
  open: [{ to: 'closed', label: 'Close fund', variant: 'outline' }],
  closed: [
    { to: 'open', label: 'Reopen', variant: 'outline' },
    { to: 'wound_up', label: 'Wind up', variant: 'outline' },
  ],
  wound_up: [],
};

export function FundStatusButtons({ fundId, status }: { fundId: string; status: FundStatus }) {
  const { run, busy } = useRunner();
  return (
    <>
      {MOVES[status].map((m) => (
        <Button
          key={m.to}
          variant={m.variant ?? 'default'}
          disabled={busy}
          onClick={() =>
            (m.to !== 'wound_up' || confirm('Wind up this fund? This cannot be undone.')) &&
            run(
              () => setFundStatusAction({ id: fundId, status: m.to }),
              `Fund is now ${m.to.replace('_', ' ')}`,
            )
          }
        >
          {m.label}
        </Button>
      ))}
    </>
  );
}
