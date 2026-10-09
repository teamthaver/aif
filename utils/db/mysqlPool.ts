import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from 'mysql2/promise';
import { env } from '@/lib/env';

const g = globalThis as unknown as { __aifPool?: Pool };

export function pool(): Pool {
  if (!g.__aifPool) {
    const p = mysql.createPool({ uri: env().DATABASE_URL, connectionLimit: 10, timezone: 'Z', charset: 'utf8mb4' });
    // defaults like CURRENT_TIMESTAMP stay in UTC
    p.on('connection', (c) => c.query("SET time_zone = '+00:00'"));
    g.__aifPool = p;
  }
  return g.__aifPool;
}

export type Db = Pool | PoolConnection;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export async function rows<T = Row>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await db.query(sql, params);
  return r as T[];
}
export async function one<T = Row>(db: Db, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(db, sql, params))[0];
}
// Runs a SELECT COUNT(*) AS n ... query and returns the number
export async function count(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const row = await one<{ n: number | string }>(db, sql, params);
  return Number(row?.n ?? 0);
}
export async function exec(db: Db, sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [r] = await db.query(sql, params);
  return r as ResultSetHeader;
}

// One transaction: the change and its audit entry commit or roll back together
export async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool().getConnection();
  try {
    await c.beginTransaction();
    const result = await fn(c);
    await c.commit();
    return result;
  } catch (err) {
    await c.rollback().catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}
