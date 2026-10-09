import { listQuery } from './list';
import { z } from 'zod';
import { uuid } from './auth';

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `Enter ${label}` })
    .positive(`${label} must be more than zero`)
    .max(1e13, `${label} is too large`);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const fundFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Code: 2-20 letters, digits or dashes'),
  name: z.string().trim().min(3, 'Enter the fund name').max(120),
  category: z.enum(['Category I', 'Category II', 'Category III']),
  strategy: text(80),
  description: text(1000),
  targetSize: money('the target size'),
  minCommitment: money('the minimum commitment'),
  tenureYears: z.coerce.number().int().min(1, 'Tenure is at least 1 year').max(30),
};
const refine = <T extends { targetSize: number; minCommitment: number }>(
  v: T,
  ctx: z.RefinementCtx,
) => {
  if (v.minCommitment > v.targetSize)
    ctx.addIssue({
      code: 'custom',
      message: 'The minimum commitment cannot exceed the target size',
    });
};
export const createFundSchema = z.object(fundFields).superRefine(refine);
export const updateFundSchema = z.object({ id: uuid, ...fundFields }).superRefine(refine);
export const fundStatusSchema = z.object({
  id: uuid,
  status: z.enum(['draft', 'open', 'closed', 'wound_up']),
});

export const assignSchema = z.object({
  fundId: uuid,
  investorId: uuid,
  commitmentAmount: money('the commitment'),
  notes: text(300),
});
export const updateAssignmentSchema = z.object({
  assignmentId: uuid,
  commitmentAmount: money('the commitment'),
  notes: text(300),
});
export const assignmentIdSchema = z.object({ assignmentId: uuid });
export const fundIdSchema = z.object({ fundId: uuid });

export const fundListSchema = listQuery;
