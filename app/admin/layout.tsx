import { AppShell } from '@/components/layout/app-shell';
import { NAV } from '@/components/admin/sidebar';
import { requireRole } from '@/lib/sessionCheck';

// This panel is for org_admin only. Anyone else is sent to their own panel (see requireRole).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole('org_admin');
  return (
    <AppShell ctx={ctx} nav={NAV} root="/admin">
      {children}
    </AppShell>
  );
}
