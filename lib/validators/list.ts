import { z } from 'zod';

// The URL-driven part of every list: ?page=2&limit=20&search=abc. Anything out of range is
// rejected, never trusted.
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
});
