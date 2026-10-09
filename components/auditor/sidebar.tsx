import type { NavItem } from '@/components/layout/sidebar-nav';

// Navigation for this role's panel
export const NAV: NavItem[] = [
  { href: '/auditor', label: 'Overview', icon: 'dashboard' },
  { href: '/auditor/funds', label: 'Funds', icon: 'funds' },
  { href: '/auditor/investors', label: 'Investors', icon: 'investors' },
  { href: '/auditor/audit', label: 'Audit log', icon: 'audit' },
];
