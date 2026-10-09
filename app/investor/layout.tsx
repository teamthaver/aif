import { AppShell } from '@/components/layout/app-shell';
import { investorNav } from '@/components/investor/sidebar';
import { getKycStatus, requireRole } from '@/lib/sessionCheck';

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole('investor');
  // unverified investors can only open the KYC page
  const locked = (await getKycStatus(ctx.user.id)) !== 'verified';
  return (
    <AppShell ctx={ctx} nav={investorNav(locked)} root="/investor">
      {children}
    </AppShell>
  );
}
