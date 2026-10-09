import { listQuery } from './list';
import { z } from 'zod';
import { uuid } from './auth';
import { ACCOUNT_RE, IFSC_RE, LAST4_RE, MOBILE_RE, PAN_RE, PINCODE_RE } from '../kyc/rules';

// A draft may be incomplete, but anything that is filled in must be well formed
const opt = (re: RegExp, msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || re.test(v), msg);
const free = (max: number) => z.string().trim().max(max);

export const kycDraftSchema = z.object({
  legalName: free(100),
  dob: z
    .string()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use the date format YYYY-MM-DD'),
  mobile: opt(MOBILE_RE, 'Mobile must be 10 digits'),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || PAN_RE.test(v), 'PAN format is not valid'),
  aadhaarLast4: opt(LAST4_RE, 'Enter exactly 4 digits'),
  addressLine1: free(150),
  addressLine2: free(150),
  city: free(80),
  state: free(80),
  pincode: opt(PINCODE_RE, 'Pincode must be 6 digits'),
  country: free(60),
  occupation: free(60),
  incomeRange: free(30),
  sourceOfFunds: free(40),
  isPep: z.enum(['', 'yes', 'no']),
  isUsPerson: z.enum(['', 'yes', 'no']),
  taxResidency: free(60),
  bankHolder: free(100),
  bankAccountNumber: opt(ACCOUNT_RE, 'Account number must be 9-18 digits'),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || IFSC_RE.test(v), 'IFSC format is not valid'),
  bankName: free(100),
});
export const kycSubmitSchema = z.object({
  declaration: z.literal(true, {
    errorMap: () => ({ message: 'Confirm the declaration to submit' }),
  }),
});

export const investorIdSchema = z.object({ investorId: uuid });
export const reviewSchema = z
  .object({
    investorId: uuid,
    decision: z.enum(['verified', 'rejected']),
    reason: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    checklist: z.object({
      identityMatches: z.boolean(),
      addressValid: z.boolean(),
      bankValid: z.boolean(),
      photoClear: z.boolean(),
      sanctionsScreened: z.boolean(),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'rejected' && (!v.reason || v.reason.length < 10))
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Tell the investor what to fix (at least 10 characters)',
      });
    if (v.decision === 'verified' && !Object.values(v.checklist).every(Boolean))
      ctx.addIssue({ code: 'custom', message: 'Tick every checklist item before verifying' });
  });
export const documentIdSchema = z.object({ documentId: uuid });
export const auditPageSchema = z.object({
  before: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export const investorListSchema = listQuery.extend({
  status: z.enum(['not_started', 'in_progress', 'submitted', 'verified', 'rejected']).optional(),
});
