import type { Pool } from 'pg';

import { parseTestDatabaseEnv } from '../../config/env';
import { createDb } from '../client';
import { RLS } from '../rls';

export function createTestDb() {
  return createDb(parseTestDatabaseEnv(process.env).TEST_DATABASE_URL);
}

export const TEST_APP_PASSWORD = 'nlm_app_test';

/** The same database as `createTestDb`, connected as the app role, so row-level security applies. */
export function createTestAppDb() {
  const url = new URL(parseTestDatabaseEnv(process.env).TEST_DATABASE_URL);
  url.username = RLS.APP_ROLE;
  url.password = TEST_APP_PASSWORD;
  return createDb(url.toString());
}

/** A unit vector along one axis: two different axes have cosine distance 1, the same axis 0. */
export function axisVector(axis: number, dimensions: number): number[] {
  return Array.from({ length: dimensions }, (_, index) => (index === axis ? 1 : 0));
}

/** Notebooks and sources belong to a Better Auth user, so tests need real user rows. */
export async function ensureUsers(pool: Pool, ids: string[]): Promise<void> {
  for (const id of ids) {
    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $1, $1 || '@example.test') ON CONFLICT DO NOTHING`,
      [id]
    );
  }
}
