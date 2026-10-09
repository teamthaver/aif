export type Role =
  'system_admin' | 'org_admin' | 'fund_manager' | 'compliance_manager' | 'auditor' | 'investor';
export type UserStatus = 'invited' | 'active' | 'suspended';
export type KycStatus = 'not_started' | 'in_progress' | 'submitted' | 'verified' | 'rejected';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string | null;
};
export type SessionOrg = { id: string; name: string; status: 'active' | 'suspended' };

// The validated identity every page and action works with. Rebuilt from the database on every
// request.
export type Ctx = { user: SessionUser; org: SessionOrg | null; ip: string | null };

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'ORG_SUSPENDED'
  | 'KYC_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'THROTTLED'
  | 'INTERNAL'
  // wrong code, the person can try again
  | 'OTP_INVALID'
  // code expired or locked: sign in again from the password step
  | 'OTP_RESTART';
export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; code: ErrorCode };

// Shown on the code screen after the password step
export type OtpStep = {
  maskedEmail: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  attemptsLeft: number;
};
