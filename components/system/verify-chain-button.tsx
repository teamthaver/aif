'use client';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { verifyAuditAction } from '@/lib/actions/audit';
import { Button } from '@/components/ui/button';
import { useRunner } from '@/components/shared/use-runner';

export function VerifyChainButton() {
  const { run, busy } = useRunner();
  async function go() {
    const r = await run(() => verifyAuditAction());
    if (r)
      (r.data.valid ? toast.success : toast.error)(
        r.data.valid
          ? `Audit chain is intact (${r.data.checked} entries checked).`
          : `Audit chain is BROKEN at entry ${r.data.brokenAtId}.`,
      );
  }
  return (
    <Button variant="outline" onClick={go} disabled={busy}>
      <ShieldCheck />
      Verify audit chain
    </Button>
  );
}
