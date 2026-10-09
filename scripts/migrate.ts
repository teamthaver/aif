import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

async function applyTriggers(conn: mysql.Connection) {
  const [done] = await conn.query('SELECT 1 FROM schema_migrations WHERE name = ?', [
    'triggers.sql',
  ]);
  if ((done as unknown[]).length) return;
  try {
    for (const stmt of fs.readFileSync('db/triggers.sql', 'utf8').split('\n---\n'))
      await conn.query(stmt);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', ['triggers.sql']);
    console.log('applied triggers.sql (audit_log is now append-only at the database level)');
  } catch (e) {
    const err = e as { code?: string; sqlMessage?: string };
    console.warn(
      `\nWARNING: could not create the audit_log protection triggers: ${err.sqlMessage ?? err.code}\n` +
        'The app still works and the audit hash chain still detects tampering, but the database will not block edits.\n' +
        'To enable them, grant TRIGGER to the app user and run SET GLOBAL log_bin_trust_function_creators = 1 (or grant SUPER), then rerun: npm run db:migrate\n',
    );
  }
}

// Applies db/migrations/*.sql in order, once each, then the audit triggers
export async function migrate(url = process.env.DATABASE_URL!) {
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
  try {
    await conn.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))',
    );
    const dir = path.join(process.cwd(), 'db/migrations');
    for (const file of fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      const [done] = await conn.query('SELECT 1 FROM schema_migrations WHERE name = ?', [file]);
      if ((done as unknown[]).length) continue;
      await conn.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`applied ${file}`);
    }
    await applyTriggers(conn);
  } finally {
    await conn.end();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  migrate().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
