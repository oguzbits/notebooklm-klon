import { sql } from 'drizzle-orm';
import { drizzle, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

import * as authSchema from './auth-schema';
import { RLS } from './rls';
import * as appSchema from './schema';

const schema = { ...appSchema, ...authSchema };

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db: Database = drizzle(pool, { schema });
  return { db, pool };
}

/** What repositories need: the pooled database and a `withUser` transaction both fit. */
export type Database = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/**
 * Runs `work` in a transaction in which row-level security knows the user. The setting is local to
 * the transaction, so it cannot leak to the next user of the pooled connection.
 */
export function withUser<T>(
  db: Database,
  userId: string,
  work: (tx: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config(${RLS.USER_SETTING}, ${userId}, true)`);
    return work(tx);
  });
}

/** `withUser` with the database already chosen: what ports take so they need no database of their own. */
export type UserScope = <T>(userId: string, work: (db: Database) => Promise<T>) => Promise<T>;

/** For code that runs as the owner (seed, eval, tests): the owner is exempt from the policies, so the user needs no setting. */
export const ownerScope =
  (db: Database): UserScope =>
  (_userId, work) =>
    work(db);
