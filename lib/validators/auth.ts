import { z } from 'zod';

export const uuid = z.string().uuid();
export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
export const password = z.string().min(6, 'Use at least 6 characters').max(200);
export const personName = z.string().trim().min(2, 'Enter a full name').max(100);

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const acceptInviteSchema = z.object({ token: z.string().min(32).max(200), password });
export const noInput = z.object({});

export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const idSchema = z.object({ id: uuid });
