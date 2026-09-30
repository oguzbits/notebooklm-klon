import type { Pool } from 'pg';

import { parseTestDatabaseEnv } from '../../config/env';
import { createDb } from '../client';

export function createTestDb() {
  return createDb(parseTestDatabaseEnv(process.env).TEST_DATABASE_URL);
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
