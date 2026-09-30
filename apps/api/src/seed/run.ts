/**
 * Makes the example notebook for the live demo: `pnpm seed:demo`. Needs the normal environment
 * plus SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD. It reads and embeds the documents of
 * apps/api/seed/demo with the real providers, so it uses a little quota once. Running it again
 * changes nothing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';

import { createAuth } from '../auth/auth';
import { createOverviewPorts } from '../chat/overview-ports';
import { parseEnv } from '../config/env';
import { user } from '../db/auth-schema';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { toLocalFile } from '../eval/corpus';
import { createLocalImportDeps } from '../ingestion/local-import-deps';
import { log } from '../logger';
import { createProviders } from '../providers';
import { seedDemo } from './demo';

const DEMO_DIR = path.resolve(import.meta.dirname, '../../seed/demo');

const env = parseEnv(process.env);
const { SEED_DEMO_EMAIL: email, SEED_DEMO_PASSWORD: password } = env;
if (!email || !password) {
  throw new Error('Set SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD to make the demo account.');
}

await runMigrations(env.DATABASE_URL);
const { db, pool } = createDb(env.DATABASE_URL);
const auth = createAuth(db, { secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
const providers = createProviders(env);

try {
  const files = readdirSync(DEMO_DIR)
    .sort()
    .map((name) => toLocalFile(name, new Uint8Array(readFileSync(path.join(DEMO_DIR, name)))));

  const { notebookId } = await seedDemo(
    { files },
    {
      db,
      importDeps: createLocalImportDeps(db, providers),
      overview: createOverviewPorts(db, providers.stream),
      ensureUser: async () => {
        const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
        if (existing) return existing.id;
        // The demo account signs in like any other; Better Auth hashes the password.
        const created = await auth.api.signUpEmail({ body: { name: email, email, password } });
        return created.user.id;
      },
    }
  );
  log({ level: 'info', msg: 'demo seeded', notebookId });
} finally {
  await pool.end();
}
