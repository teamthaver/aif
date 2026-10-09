import { AppShell } from '@/components/layout/app-shell';
import { NAV } from '@/components/auditor/sidebar';
import { requireRole } from '@/lib/sessionCheck';

// This panel is for auditor only. Anyone else is sent to their own panel (see requireRole).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole('auditor');
  return (
    <AppShell ctx={ctx} nav={NAV} root="/auditor">
      {children}
    </AppShell>
  );
}
