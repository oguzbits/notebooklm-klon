import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { parseDatabaseEnv } from '../config/env';
import { createDb } from './client';

export const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../drizzle');

export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

// Run as a script: `pnpm --filter @nlm/api db:migrate`
if (process.argv[1] === import.meta.filename) {
  try {
    const { DATABASE_URL } = parseDatabaseEnv(process.env);
    await runMigrations(DATABASE_URL);
    process.stdout.write(`${JSON.stringify({ level: 'info', msg: 'migrations applied' })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
