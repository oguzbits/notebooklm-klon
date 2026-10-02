/**
 * The whole app with the model and the embedding replaced by fakes (see fakes.ts). Everything else
 * is real: Postgres, sessions, uploads, parsing of text, DOCX and web pages, hybrid search, the
 * citation check. PDFs are not readable here (that needs the provider) and end as failed sources,
 * which is also a state worth seeing.
 *
 *   pnpm --filter @nlm/api dev:offline     (needs DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL)
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { serve } from '@hono/node-server';
import { EMBEDDING_DIMENSIONS } from '@nlm/shared';
import { eq } from 'drizzle-orm';

import type { ChatInput } from '../ai/gemini-chat';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createNotebookOverviewPorts } from '../chat/notebook-overview-ports';
import { createOverviewPorts } from '../chat/overview-ports';
import { parseOfflineServerEnv } from '../config/env';
import { NOTEBOOK_OVERVIEW_SYSTEM_PROMPT } from '../core/notebook-overview-prompt';
import { OVERVIEW_SYSTEM_PROMPT } from '../core/overview-prompt';
import { user } from '../db/auth-schema';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createQuota } from '../db/quota';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import { toLocalFile } from '../eval/corpus';
import { systemDeps } from '../import/system-deps';
import { createLocalImportDeps } from '../ingestion/local-import-deps';
import { runIngestJob, type SubmitPorts } from '../ingestion/submit';
import { errorName, log } from '../logger';
import { createParseSource } from '../parsing/parse-source';
import { seedDemo } from '../seed/demo';
import { s3ConfigFromEnv } from '../storage/s3-config';
import { createS3ObjectStore } from '../storage/s3-object-store';
import { serveWeb } from '../web/serve-web';
import {
  extractiveAnswer,
  fakeNotebookOverview,
  fakeOverview,
  fakeStudio,
  hashEmbedding,
  trickle,
} from './fakes';

const STUDIO_PROPERTIES = ['sections', 'cards', 'questions', 'branches', 'rows'];

/** Picks the stand-in by what is asked: the overview, a Studio output or a chat answer. */
function fakeReply(input: ChatInput): string {
  if (input.system === OVERVIEW_SYSTEM_PROMPT) return fakeOverview(input.user);
  if (input.system === NOTEBOOK_OVERVIEW_SYSTEM_PROMPT) return fakeNotebookOverview(input.user);
  const properties = Object.keys((input.schema.properties ?? {}) as Record<string, unknown>);
  if (STUDIO_PROPERTIES.some((name) => properties.includes(name))) {
    return fakeStudio(input.schema, input.user);
  }
  return extractiveAnswer(input.user);
}

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
            name: errorName(error),
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

const stream = (input: ChatInput) => trickle(fakeReply(input));

// The example notebook that guests get a copy of, made with the fakes. Safe to run again.
const DEMO_OWNER_EMAIL = 'beispiel@offline.invalid';
const DEMO_DIR = path.resolve(import.meta.dirname, '../../seed/demo');
await seedDemo(
  {
    files: readdirSync(DEMO_DIR)
      .sort()
      .map((name) => toLocalFile(name, new Uint8Array(readFileSync(path.join(DEMO_DIR, name))))),
  },
  {
    db,
    importDeps: createLocalImportDeps(db, { parse: ingest.parse, embedDocuments: ingest.embed }),
    overview: createOverviewPorts(db, stream),
    notebookOverview: createNotebookOverviewPorts(db, stream),
    ensureUser: async () => {
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, DEMO_OWNER_EMAIL));
      if (existing) return existing.id;
      // Nobody signs in as the owner: the password is thrown away.
      const created = await auth.api.signUpEmail({
        body: { name: 'Demo', email: DEMO_OWNER_EMAIL, password: randomUUID() },
      });
      return created.user.id;
    },
  }
);

// Cover images only where an object store is given (the S3 container of `pnpm db:up`).
const s3Config = s3ConfigFromEnv(env);
const s3 = s3Config ? createS3ObjectStore(s3Config) : null;
await s3?.ensureBucket();
const objectStore = s3;

const app = createApp({
  auth,
  db,
  ingest,
  demoOwnerEmail: DEMO_OWNER_EMAIL,
  fetch: systemDeps,
  // The offline server has no search service.
  webSearch: null,
  objectStore,
  chat: {
    embedQuery: async (text) => hashEmbedding(text, EMBEDDING_DIMENSIONS),
    stream,
    onError: (error) =>
      log({
        level: 'error',
        msg: 'chat failed',
        name: errorName(error),
      }),
  },
});

if (env.WEB_DIST_DIR) serveWeb(app, env.WEB_DIST_DIR);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log({ level: 'info', msg: 'offline server listening', port: info.port });
});
