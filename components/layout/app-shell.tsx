import { ShieldCheck } from 'lucide-react';
import { RoleBadge } from '@/components/shared/badges';
import type { Ctx } from '@/utils/types';
import { SidebarNav, type NavItem } from './sidebar-nav';
import { SignOutButton } from './sign-out-button';
import Image from 'next/image';

// The frame every role panel shares. Each panel passes its own navigation, and its own layout does
// the session check.
export function AppShell({
  ctx,
  nav,
  root,
  children,
}: {
  ctx: Ctx;
  nav: NavItem[];
  root: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen md:grid-cols-[250px_1fr]">
      <aside className="flex flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-screen">
        <div className="flex items-center gap-2 px-2 pt-1 text-lg font-semibold text-white">
          <Image
            src={"/images/logo.png"}
            height={24}
            width={24}
            alt='Logo'
          />
          ThaverTech
        </div>
        <SidebarNav items={nav} root={root} />
        <div className="mt-auto hidden border-t border-sidebar-border px-2 pt-4 text-xs text-sidebar-foreground/60 md:block">
          {ctx.org?.name ?? 'Platform administration'}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-3">
          <div className="text-sm text-muted-foreground">
            {ctx.org?.name ?? 'All organizations'}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{ctx.user.name}</span>
            <RoleBadge role={ctx.user.role} />
            <SignOutButton to={ctx.user.role === 'system_admin' ? '/system/login' : '/login'} />
          </div>
        </header>
        <main className="grid flex-1 content-start gap-6 p-6">{children}</main>
      </div>
    </div>
  );
}
