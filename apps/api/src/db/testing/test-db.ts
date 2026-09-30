import { parseTestDatabaseEnv } from '../../config/env';
import { createDb } from '../client';

export function createTestDb() {
  return createDb(parseTestDatabaseEnv(process.env).TEST_DATABASE_URL);
}

/** A unit vector along one axis: two different axes have cosine distance 1, the same axis 0. */
export function axisVector(axis: number, dimensions: number): number[] {
  return Array.from({ length: dimensions }, (_, index) => (index === axis ? 1 : 0));
}
