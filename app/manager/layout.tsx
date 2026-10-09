import { AppShell } from '@/components/layout/app-shell';
import { NAV } from '@/components/manager/sidebar';
import { requireRole } from '@/lib/sessionCheck';

// This panel is for fund_manager only. Anyone else is sent to their own panel (see requireRole).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole('fund_manager');
  return (
    <AppShell ctx={ctx} nav={NAV} root="/manager">
      {children}
    </AppShell>
  );
}
