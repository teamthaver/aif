import { AppShell } from '@/components/layout/app-shell';
import { NAV } from '@/components/compliance/sidebar';
import { requireRole } from '@/lib/sessionCheck';

// This panel is for compliance_manager only. Anyone else is sent to their own panel (see
// requireRole).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole('compliance_manager');
  return (
    <AppShell ctx={ctx} nav={NAV} root="/compliance">
      {children}
    </AppShell>
  );
}
