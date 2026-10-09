import type { Role } from '@/utils/types';

export const ROLES: Role[] = [
  'system_admin',
  'org_admin',
  'fund_manager',
  'compliance_manager',
  'auditor',
  'investor',
];
export const ORG_ROLES: Role[] = ROLES.filter((r) => r !== 'system_admin');

export const ROLE_LABEL: Record<Role, string> = {
  system_admin: 'System admin',
  org_admin: 'Organization admin',
  fund_manager: 'Fund manager',
  compliance_manager: 'Compliance manager',
  auditor: 'Auditor',
  investor: 'Investor',
};
// Each role has its own panel (its own route tree and layout)
export const HOME: Record<Role, string> = {
  system_admin: '/system',
  org_admin: '/admin',
  fund_manager: '/manager',
  compliance_manager: '/compliance',
  auditor: '/auditor',
  investor: '/investor',
};

export type Permission =
  | 'organizations:view'
  | 'organizations:create'
  | 'organizations:edit'
  // an organization sets its own type and registration number (org admin only)
  | 'organizations:profile'
  | 'users:view'
  | 'users:create'
  | 'users:manage'
  | 'funds:view'
  | 'funds:create'
  | 'funds:edit'
  | 'assignments:view'
  | 'assignments:manage'
  | 'investors:view'
  | 'kyc:view'
  | 'kyc:documents'
  | 'kyc:review'
  | 'audit:view';

// The whole access model in one table.
// - system admin: creates organizations and their first admins. Never sees funds, investors or KYC
// data.
// - org admin:    sees everything in the organization, sets the organization's own type, creates
// any kind of user, cannot create funds or verify KYC.
// - fund manager: creates funds, assigns and maintains investors, creates investors (nobody else),
// verifies KYC.
//  - compliance:   verifies investors (KYC), read-only on funds, sees the audit trail.
//  - auditor:      read-only. Sees KYC status but not documents or full identity numbers.
//  - investor:     own panel only, separate from the above (own pages only).
export const PERMISSIONS: Record<Role, readonly Permission[]> = {
  system_admin: [
    'organizations:view',
    'organizations:create',
    'organizations:edit',
    'users:view',
    'users:create',
    'users:manage',
    'audit:view',
  ],
  org_admin: [
    'organizations:view',
    'organizations:profile',
    'users:view',
    'users:create',
    'users:manage',
    'funds:view',
    'assignments:view',
    'investors:view',
    'kyc:view',
    'kyc:documents',
    'audit:view',
  ],
  fund_manager: [
    'users:view',
    'users:create',
    'users:manage',
    'funds:view',
    'funds:create',
    'funds:edit',
    'assignments:view',
    'assignments:manage',
    'investors:view',
    'kyc:view',
    'kyc:documents',
    'kyc:review',
  ],
  compliance_manager: [
    'funds:view',
    'assignments:view',
    'investors:view',
    'kyc:view',
    'kyc:documents',
    'kyc:review',
    'audit:view',
  ],
  auditor: ['funds:view', 'assignments:view', 'investors:view', 'kyc:view', 'audit:view'],
  investor: [],
};

export const can = (role: Role, perm: Permission) => PERMISSIONS[role].includes(perm);

// Who may create whom, who may be suspended/reactivated, and whose profiles a role may list
export const CREATABLE_ROLES: Record<Role, Role[]> = {
  system_admin: ['org_admin'],
  org_admin: ['org_admin', 'fund_manager', 'compliance_manager', 'auditor', 'investor'],
  fund_manager: ['investor'],
  compliance_manager: [],
  auditor: [],
  investor: [],
};
export const MANAGEABLE_ROLES: Record<Role, Role[]> = {
  system_admin: ['org_admin'],
  org_admin: ['org_admin', 'fund_manager', 'compliance_manager', 'auditor', 'investor'],
  fund_manager: ['investor'],
  compliance_manager: [],
  auditor: [],
  investor: [],
};
export const VIEWABLE_ROLES: Record<Role, Role[]> = {
  system_admin: ['org_admin'],
  org_admin: ORG_ROLES,
  fund_manager: ['investor'],
  compliance_manager: [],
  auditor: [],
  investor: [],
};
