import type { NavItem } from '@/components/layout/sidebar-nav';

// Navigation for this role's panel
export const NAV: NavItem[] = [
  { href: '/compliance', label: 'Overview', icon: 'dashboard' },
  { href: '/compliance/kyc', label: 'KYC reviews', icon: 'kyc' },
  { href: '/compliance/funds', label: 'Funds', icon: 'funds' },
  { href: '/compliance/audit', label: 'Audit log', icon: 'audit' },
];
