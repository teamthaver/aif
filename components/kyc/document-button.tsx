'use client';
import { FileText } from 'lucide-react';
import { getKycDocumentAction } from '@/lib/actions/kyc';
import { Button } from '@/components/ui/button';
import { useRunner } from '@/components/shared/use-runner';

// Fetches the file through a Server Action, so the access check runs on every open
export function DocumentButton({ documentId, label }: { documentId: string; label: string }) {
  const { run, busy } = useRunner();
  async function open() {
    const r = await run(() => getKycDocumentAction({ documentId }));
    if (!r) return;
    const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: r.data.mime }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={open}>
      <FileText />
      {label}
    </Button>
  );
}
