import type { NavItem } from '@/components/layout/sidebar-nav';

// Navigation for this role's panel
export const NAV: NavItem[] = [
  { href: '/system', label: 'Overview', icon: 'dashboard' },
  { href: '/system/organizations', label: 'Organizations', icon: 'orgs' },
  { href: '/system/audit', label: 'Audit log', icon: 'audit' },
];
