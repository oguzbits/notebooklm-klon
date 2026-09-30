import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as authSchema from './auth-schema';
import * as appSchema from './schema';

const schema = { ...appSchema, ...authSchema };

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

export type Database = ReturnType<typeof createDb>['db'];
