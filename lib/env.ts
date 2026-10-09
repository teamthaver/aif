import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(8),
  INVITE_TTL_HOURS: z.coerce.number().positive().default(48),
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine(
      (k) => Buffer.from(k, 'base64').length === 32,
      'DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded',
    ),
  OTP_TTL_MINUTES: z.coerce.number().positive().default(5),
  // 'console' prints the code on the server (development only). Anything real needs a provider: see
  // lib/notify.ts
  OTP_DELIVERY: z.enum(['console', 'none']).optional(),
  NODE_ENV: z.string().default('development'),
});

let cached: z.infer<typeof schema> | undefined;
// Read lazily so `next build` works without secrets present
export const env = () => (cached ??= schema.parse(process.env));
export const isProd = () => env().NODE_ENV === 'production';
