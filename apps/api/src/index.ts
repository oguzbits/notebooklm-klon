import { serve } from '@hono/node-server';

import { createApp } from './app';
import { createAuth } from './auth/auth';
import { parseEnv } from './config/env';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { createQuota } from './db/quota';
import { createSourceStorage, createUploadStorage } from './db/source-storage';
import { systemDeps } from './import/system-deps';
import { IngestError } from './ingestion/ingest';
import { runIngestJob, type SubmitPorts } from './ingestion/submit';
import { createJobQueue } from './jobs/queue';
import { log } from './logger';
import { createProviders } from './providers';
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
const auth = createAuth(db, { secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });

const queue = await createJobQueue(env.DATABASE_URL, {
  onError: (error) => log({ level: 'error', msg: 'queue error', name: error.name }),
});

// Every provider call goes through the limiter of its role.
const providers = createProviders(env);

const ingest: SubmitPorts = {
  sources: createSourceStorage(db),
  uploads: createUploadStorage(db),
  queue,
  assertCanCreate: createQuota(db),
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
      name: error instanceof Error ? error.name : 'unknown',
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
  fetch: systemDeps,
  chat: {
    embedQuery: providers.embedQuery,
    stream: providers.stream,
    onError: (error) =>
      log({
        level: 'error',
        msg: 'chat failed',
        name: error instanceof Error ? error.name : 'unknown',
      }),
  },
});

if (env.WEB_DIST_DIR) serveWeb(app, env.WEB_DIST_DIR);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log({ level: 'info', msg: 'listening', port: info.port });
});
