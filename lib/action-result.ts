import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AppError } from './errors';
import type { ActionResult, ErrorCode } from '@/utils/types';

function fail(e: unknown): { ok: false; error: string; code: ErrorCode } {
  if (e instanceof z.ZodError)
    return { ok: false, error: e.issues.map((i) => i.message).join('. '), code: 'VALIDATION' };
  if (e instanceof AppError) return { ok: false, error: e.message, code: e.code };
  if ((e as { code?: string })?.code === 'ER_DUP_ENTRY')
    return { ok: false, error: 'That already exists.', code: 'CONFLICT' };
  // let Next's redirect/notFound signals through
  if (e && typeof e === 'object' && 'digest' in e) throw e;
  console.error(e);
  return {
    ok: false,
    error: 'Something went wrong on our side. Please try again.',
    code: 'INTERNAL',
  };
}

// Wraps the body of a Server Action: turns thrown errors into { ok: false, error, code } and, after
// a change, refreshes the pages. It contains no business logic; the logic is written inside each
// action.
export async function runAction<T>(
  body: () => Promise<T>,
  opts: { refresh?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const data = await body();
    if (opts.refresh !== false) revalidatePath('/', 'layout');
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}
