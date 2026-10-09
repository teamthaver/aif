import type { KycStatus, Role, UserStatus } from './auth';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  kycStatus: KycStatus | null;
};
export type CreatedUser = { id: string; email: string; role: Role; inviteToken?: string };
