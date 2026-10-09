import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID();
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Stable JSON (sorted keys) so an audit hash survives a round trip through a JSON column
export function canonical(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

// mysql2 parses JSON columns, but other drivers and MariaDB return text
export const asJson = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : (v as T));
export const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
// Turns the validated page/limit/search into SQL pieces. `like` has its wildcards escaped so a
// search for "50%" means 50%.
export function pageArgs(q: { page?: number; limit?: number; search?: string }) {
  const limit = q.limit ?? 20,
    page = q.page ?? 1,
    search = q.search ?? '';
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    search,
    like: `%${search.replace(/[\\%_]/g, '\\$&')}%`,
  };
}
export const paged = <T>(rows: T[], total: number, page: number, limit: number) => ({
  rows,
  total,
  page,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
export const num = (v: unknown) => Number(v ?? 0);
