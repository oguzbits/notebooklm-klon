import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createAuth } from './auth/auth';
import { parseEnv } from './config/env';
import { LIMITS } from './config/limits';
import { createDb } from './db/client';
import { deleteExpiredGuests } from './db/guest-repository';
import { runMigrations } from './db/migrate';
import {
  createSourceStorage,
  createUploadStorage,
  failInterruptedSources,
} from './db/source-storage';
import { systemDeps } from './import/system-deps';
import { IngestError } from './ingestion/ingest';
import { runIngestJob, type SubmitPorts } from './ingestion/submit';
import { createJobQueue } from './jobs/queue';
import { errorName, log } from './logger';
import { createProviders } from './providers';
import { createTavilySearch } from './search/tavily-search';
import { createShutdown } from './shutdown';
import { userCoverPrefix } from './storage/cover-key';
import type { ObjectStore } from './storage/object-store';
import { removePrefixQuietly } from './storage/remove-quietly';
import { s3ConfigFromEnv } from './storage/s3-config';
import { createS3ObjectStore } from './storage/s3-object-store';
import { serveWeb } from './web/serve-web';

let env;
try {
  env = parseEnv(process.env);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

await runMigrations(env.DATABASE_URL);

const { db } = createDb(env.DATABASE_URL);
// Cover images need an S3-compatible store; without one they are not offered.
const s3Config = s3ConfigFromEnv(env);
const s3 = s3Config ? createS3ObjectStore(s3Config) : null;
await s3?.ensureBucket();
const objectStore: ObjectStore | null = s3;

const auth = createAuth(db, {
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  objectStore,
});

const queue = await createJobQueue(env.DATABASE_URL, {
  onError: (error) => log({ level: 'error', msg: 'queue error', name: error.name }),
});

// Every provider call goes through the limiter of its role.
const providers = createProviders(env);

const ingest: SubmitPorts = {
  sources: createSourceStorage(db, { enforceQuota: true }),
  uploads: createUploadStorage(db),
  queue,
  parse: providers.parse,
  embed: providers.embedDocuments,
};

await queue.work(async (payload) => {
  const started = Date.now();
  try {
    await runIngestJob(payload, ingest);
  } catch (error) {
    // Name and code only: the message of a provider or parser error could carry document content.
    log({
      level: 'error',
      msg: 'ingestion job failed',
      name: errorName(error),
      code: error instanceof IngestError ? error.code : undefined,
      durationMs: Date.now() - started,
    });
    throw error;
  }
  log({ level: 'info', msg: 'ingestion job done', durationMs: Date.now() - started });
});

const app = createApp({
  auth,
  db,
  ingest,
  demoOwnerEmail: env.SEED_DEMO_EMAIL,
  fetch: systemDeps,
  webSearch: env.TAVILY_API_KEY ? createTavilySearch({ apiKey: env.TAVILY_API_KEY }) : null,
  objectStore,
  chat: {
    embedQuery: providers.embedQuery,
    translateQuery: providers.translateQuery,
    stream: providers.stream,
    onError: (error) =>
      log({
        level: 'error',
        msg: 'chat failed',
        name: errorName(error),
      }),
  },
});

// Guests of the live demo are deleted after a few days, with everything they own.
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
async function removeExpiredGuests() {
  const deleted = await deleteExpiredGuests(
    db,
    new Date(Date.now() - LIMITS.GUEST_LIFETIME_DAYS * DAY_MS)
  );
  if (objectStore) {
    for (const userId of deleted) await removePrefixQuietly(objectStore, userCoverPrefix(userId));
  }
  if (deleted.length > 0)
    log({ level: 'info', msg: 'expired guests deleted', count: deleted.length });
}
// A job the process did not finish (restart, crash) is not retried: fail its source so it can be uploaded again.
async function sweepInterruptedSources() {
  const count = await failInterruptedSources(
    db,
    new Date(Date.now() - LIMITS.INTERRUPTED_JOB_AFTER_MS)
  );
  if (count > 0) log({ level: 'warn', msg: 'interrupted sources failed', count });
}
await removeExpiredGuests();
await sweepInterruptedSources();
setInterval(() => {
  removeExpiredGuests().catch((error: unknown) =>
    log({
      level: 'error',
      msg: 'guest cleanup failed',
      name: errorName(error),
    })
  );
  sweepInterruptedSources().catch((error: unknown) =>
    log({
      level: 'error',
      msg: 'interrupted source cleanup failed',
      name: errorName(error),
    })
  );
}, HOUR_MS).unref();

if (env.WEB_DIST_DIR) serveWeb(app, env.WEB_DIST_DIR);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log({ level: 'info', msg: 'listening', port: info.port });
});

// A deploy stops the container with SIGTERM: finish open requests, let the running job end.
const shutdown = createShutdown({
  closeServer: () =>
    new Promise<void>((resolve) => {
      const giveUp = setTimeout(resolve, LIMITS.SHUTDOWN_SERVER_WAIT_MS);
      server.close(() => {
        clearTimeout(giveUp);
        resolve();
      });
    }),
  stopQueue: () => queue.stop(LIMITS.SHUTDOWN_JOB_WAIT_MS),
});
process.once('SIGTERM', () => {
  log({ level: 'info', msg: 'shutting down' });
  shutdown().then(
    () => process.exit(0),
    (error: unknown) => {
      log({ level: 'error', msg: 'shutdown failed', name: errorName(error) });
      process.exit(1);
    }
  );
});
