/**
 * The whole app with the model and the embedding replaced by fakes (see fakes.ts). Everything else
 * is real: Postgres, sessions, uploads, parsing of text, DOCX and web pages, hybrid search, the
 * citation check. PDFs are not readable here (that needs the provider) and end as failed sources,
 * which is also a state worth seeing.
 *
 *   pnpm --filter @nlm/api dev:offline     (needs DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL)
 */
import { serve } from '@hono/node-server';
import { EMBEDDING_DIMENSIONS } from '@nlm/shared';

import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { parseOfflineServerEnv } from '../config/env';
import { OVERVIEW_SYSTEM_PROMPT } from '../core/overview-prompt';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createQuota } from '../db/quota';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import { systemDeps } from '../import/system-deps';
import { runIngestJob, type SubmitPorts } from '../ingestion/submit';
import { log } from '../logger';
import { createParseSource } from '../parsing/parse-source';
import { serveWeb } from '../web/serve-web';
import { extractiveAnswer, fakeOverview, hashEmbedding, trickle } from './fakes';

const env = parseOfflineServerEnv(process.env);
await runMigrations(env.DATABASE_URL);

const { db } = createDb(env.DATABASE_URL);
const auth = createAuth(db, { secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });

const ingest: SubmitPorts = {
  sources: createSourceStorage(db),
  uploads: createUploadStorage(db),
  // No job queue: the job runs right after the request, in this process.
  queue: {
    enqueue: async (sourceId) => {
      setTimeout(() => {
        runIngestJob({ sourceId }, ingest).catch((error: unknown) => {
          log({
            level: 'error',
            msg: 'offline ingestion failed',
            name: error instanceof Error ? error.name : 'unknown',
          });
        });
      }, 0);
    },
  },
  assertCanCreate: createQuota(db),
  parse: createParseSource({
    parse: async () => {
      throw new Error('PDFs need the provider and cannot be read offline.');
    },
  }),
  embed: async (texts) => texts.map((text) => hashEmbedding(text, EMBEDDING_DIMENSIONS)),
};

const app = createApp({
  auth,
  db,
  ingest,
  fetch: systemDeps,
  chat: {
    embedQuery: async (text) => hashEmbedding(text, EMBEDDING_DIMENSIONS),
    stream: (input) =>
      trickle(
        input.system === OVERVIEW_SYSTEM_PROMPT
          ? fakeOverview(input.user)
          : extractiveAnswer(input.user)
      ),
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
  log({ level: 'info', msg: 'offline server listening', port: info.port });
});
