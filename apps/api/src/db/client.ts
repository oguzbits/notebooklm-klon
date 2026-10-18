import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as authSchema from './auth-schema';
import { RLS } from './rls';
import * as appSchema from './schema';

const schema = { ...appSchema, ...authSchema };

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

export type Database = ReturnType<typeof createDb>['db'];

/** The transaction `withUser` hands out: every statement in it sees only the rows of one user. */
export type UserDb = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Runs `work` in a transaction in which row-level security knows the user. The setting is local to
 * the transaction, so it cannot leak to the next user of the pooled connection.
 */
export function withUser<T>(
  db: Database,
  userId: string,
  work: (tx: UserDb) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config(${RLS.USER_SETTING}, ${userId}, true)`);
    return work(tx);
  });
}
