import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { anonymous } from 'better-auth/plugins';

import * as authSchema from '../db/auth-schema';
import type { Database } from '../db/client';
import { userCoverPrefix } from '../storage/cover-key';
import type { ObjectStore } from '../storage/object-store';
import { removePrefixQuietly } from '../storage/remove-quietly';

const MIN_PASSWORD_LENGTH = 8;

export interface AuthConfig {
  secret: string;
  /** Public origin of the app. Requests from any other origin are refused. */
  baseURL: string;
  /** Where the files of a user live. Without one there are none to remove with the account. */
  objectStore?: ObjectStore | null;
}

/** Sessions and accounts in our own PostgreSQL. Email and password, no email verification yet, and guests for the demo. */
export function createAuth(db: Database, config: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    // The user asks with their password. The rows go with the user (foreign keys cascade); the
    // files in the object store are removed afterwards, best effort like every other file removal.
    user: {
      deleteUser: {
        enabled: true,
        afterDelete: async (deleted) => {
          if (config.objectStore) {
            await removePrefixQuietly(config.objectStore, userCoverPrefix(deleted.id));
          }
        },
      },
    },
    // Guests of the live demo. Only the guest route may make one (see app.ts).
    plugins: [anonymous()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
