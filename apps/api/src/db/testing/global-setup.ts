import { Client } from 'pg';

import { parseTestDatabaseEnv } from '../../config/env';
import { runMigrations } from '../migrate';
import { RLS } from '../rls';
import { TEST_APP_PASSWORD } from './test-db';

/** Resets the *_test database and applies all migrations once per `pnpm test:db` run. */
export default async function setup(): Promise<void> {
  const { TEST_DATABASE_URL } = parseTestDatabaseEnv(process.env);

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }

  await runMigrations(TEST_DATABASE_URL);

  // The migration makes the app role without a password: the tests that connect as the app give it one.
  const owner = new Client({ connectionString: TEST_DATABASE_URL });
  await owner.connect();
  try {
    await owner.query(`ALTER ROLE ${RLS.APP_ROLE} LOGIN PASSWORD '${TEST_APP_PASSWORD}'`);
  } finally {
    await owner.end();
  }
}
