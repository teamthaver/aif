import type { NavItem } from '@/components/layout/sidebar-nav';

// Navigation for this role's panel
export const NAV: NavItem[] = [
  { href: '/manager', label: 'Overview', icon: 'dashboard' },
  { href: '/manager/funds', label: 'Funds', icon: 'funds' },
  { href: '/manager/investors', label: 'Investors', icon: 'investors' },
  { href: '/manager/kyc', label: 'KYC reviews', icon: 'kyc' },
];
