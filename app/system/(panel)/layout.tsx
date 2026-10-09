import { AppShell } from '@/components/layout/app-shell';
import { NAV } from '@/components/system/sidebar';
import { requireRole } from '@/lib/sessionCheck';

// This panel is for system_admin only. Anyone else is sent to their own panel (see requireRole).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole('system_admin');
  return (
    <AppShell ctx={ctx} nav={NAV} root="/system">
      {children}
    </AppShell>
  );
}
