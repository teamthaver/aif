import { z } from 'zod';
import { ORG_TYPES } from '../org-types';
import { email, personName, uuid } from './auth';

const regNo = z
  .string()
  .trim()
  .max(60)
  .optional()
  .or(z.literal('').transform(() => undefined));
const orgName = z.string().trim().min(2, 'Enter the organization name').max(120);

// The system admin creates an organization with a name and its first admin. The TYPE is not theirs
// to choose.
export const createOrgSchema = z.object({
  name: orgName,
  registrationNo: regNo,
  adminName: personName,
  adminEmail: email,
});
export const updateOrgSchema = z.object({ id: uuid, name: orgName, registrationNo: regNo });
export const orgStatusSchema = z.object({ id: uuid, status: z.enum(['active', 'suspended']) });

// The organization sets its own type (and registration number) through its org admin
export const orgProfileSchema = z.object({
  type: z.enum(ORG_TYPES, { errorMap: () => ({ message: 'Choose your organization type' }) }),
  registrationNo: regNo,
});
