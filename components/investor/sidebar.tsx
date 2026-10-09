import type { NavItem } from '@/components/layout/sidebar-nav';

// Unverified investors can only open the KYC page; the rest of the menu is locked until KYC is
// verified
export const investorNav = (locked: boolean): NavItem[] => [
  { href: '/investor/kyc', label: 'KYC verification', icon: 'verify' },
  { href: '/investor', label: 'Overview', icon: 'dashboard', locked },
  { href: '/investor/funds', label: 'My funds', icon: 'funds', locked },
  { href: '/investor/profile', label: 'My profile', icon: 'profile', locked },
];
