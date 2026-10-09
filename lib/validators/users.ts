import { z } from 'zod';
import { listQuery } from './list';
import { email, personName, uuid } from './auth';

export const createUserSchema = z.object({
  name: personName,
  email,
  role: z.enum(['org_admin', 'fund_manager', 'compliance_manager', 'auditor', 'investor']),
  // only a system admin passes this; everyone else is locked to their own organization
  orgId: uuid.optional(),
});
export const userIdSchema = z.object({ userId: uuid });
export const userStatusSchema = z.object({ userId: uuid, status: z.enum(['active', 'suspended']) });

export const listUsersSchema = listQuery.extend({
  // only a system admin passes this
  orgId: uuid.optional(),
  roles: z
    .array(z.enum(['org_admin', 'fund_manager', 'compliance_manager', 'auditor', 'investor']))
    .optional(),
});
