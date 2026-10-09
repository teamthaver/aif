'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  History,
  LayoutDashboard,
  Lock,
  Landmark,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  dashboard: LayoutDashboard,
  orgs: Building2,
  users: Users,
  funds: Landmark,
  investors: Wallet,
  kyc: ClipboardCheck,
  audit: History,
  admins: UserCog,
  profile: ShieldCheck,
  verify: FileCheck2,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; locked?: boolean };

export function SidebarNav({ items, root }: { items: NavItem[]; root: string }) {
  const path = usePathname();
  return (
    <nav className="grid gap-1" aria-label="Main">
      {items.map((n) => {
        const Icon = ICONS[n.icon];
        const on =
          n.href === root ? path === root : path === n.href || path.startsWith(n.href + '/');
        const cls = cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors',
          on && 'bg-sidebar-primary font-medium text-sidebar-primary-foreground',
        );
        if (n.locked) {
          return (
            <span
              key={n.href}
              className={cn(cls, 'cursor-not-allowed opacity-50')}
              title="Available after your KYC is verified"
            >
              <Icon className="size-4" />
              {n.label}
              <Lock className="ml-auto size-3.5" />
            </span>
          );
        }
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              cls,
              !on && 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
