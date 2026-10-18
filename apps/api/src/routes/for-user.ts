import type { AppDeps } from '../app-deps';
import { type Database, withUser } from '../db/client';

/**
 * Runs the database work of one user in a transaction in which row-level security knows the user:
 * the policies are the second layer behind the `WHERE user_id = ...` of the queries.
 */
export const forUser = <T>(deps: AppDeps, userId: string, work: (db: Database) => Promise<T>) =>
  withUser(deps.db, userId, work);
