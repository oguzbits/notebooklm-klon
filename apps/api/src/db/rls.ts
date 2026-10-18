import { type AnyColumn, sql } from 'drizzle-orm';
import { pgPolicy, pgRole } from 'drizzle-orm/pg-core';

/**
 * Row-level security, the second layer behind the `WHERE user_id = ...` of every query. The app
 * connects as `nlm_app`, which is not the owner of the tables, so these policies apply to it; the
 * owner (migrations, system jobs) is exempt. `withUser` sets the setting for one transaction. Without
 * it the setting is NULL and no row matches: a missing user sees nothing.
 */
export const RLS = {
  USER_SETTING: 'app.user_id',
  APP_ROLE: 'nlm_app',
} as const;

// The role is created by provision.sh and the test setup (it has a password), never by a migration.
const appRole = pgRole(RLS.APP_ROLE).existing();

const currentUser = sql.raw(`current_setting('${RLS.USER_SETTING}', true)`);

/** A table with its own `user_id`: the app sees and writes only the rows of the current user. */
export const ownRows = (table: string, userId: AnyColumn) =>
  pgPolicy(`${table}_own_rows`, {
    for: 'all',
    to: appRole,
    using: sql`${userId} = ${currentUser}`,
    withCheck: sql`${userId} = ${currentUser}`,
  });

/** A table without `user_id`: a row belongs to the user who owns the parent row it points to. */
export const rowsOfOwned = (
  table: string,
  parent: string,
  parentId: AnyColumn,
  parentUserId: AnyColumn
) => {
  const owned = sql`exists (select 1 from ${sql.raw(parent)} where ${sql.raw(parent)}.id = ${parentId} and ${parentUserId} = ${currentUser})`;
  return pgPolicy(`${table}_own_rows`, { for: 'all', to: appRole, using: owned, withCheck: owned });
};
