import type { NavItem } from '@/components/layout/sidebar-nav';

// Navigation for this role's panel
export const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: 'dashboard' },
  { href: '/admin/organization', label: 'Organization', icon: 'orgs' },
  { href: '/admin/users', label: 'Users', icon: 'users' },
  { href: '/admin/funds', label: 'Funds', icon: 'funds' },
  { href: '/admin/investors', label: 'Investors', icon: 'investors' },
  { href: '/admin/audit', label: 'Audit log', icon: 'audit' },
];
