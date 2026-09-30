import { existsSync } from 'node:fs';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDb } from './client';
import { resolveMigrationsFolder } from './migrations-folder';

export const MIGRATIONS_FOLDER = resolveMigrationsFolder(import.meta.dirname, existsSync);

export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
