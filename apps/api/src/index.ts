import { serve } from '@hono/node-server';

import { createGeminiEmbedder } from './ai/gemini-embedder';
import { createGeminiPdfParser } from './ai/gemini-pdf-parser';
import { RateLimiter, systemClock } from './ai/rate-limiter';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { parseEnv } from './config/env';
import { PROVIDER_LIMITS } from './config/limits';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { createQuota } from './db/quota';
import { createSourceStorage, createUploadStorage } from './db/source-storage';
import { systemDeps } from './import/system-deps';
import { runIngestJob, type SubmitPorts } from './ingestion/submit';
import { createJobQueue } from './jobs/queue';
import { log } from './logger';
import { createParseSource } from './parsing/parse-source';

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
const provider = { apiKey: env.GEMINI_API_KEY, sleep: systemClock.sleep };
const pdfParser = createGeminiPdfParser({
  ...provider,
  model: env.PARSE_MODEL,
  limiter: new RateLimiter(PROVIDER_LIMITS.PARSE),
});
const embedder = createGeminiEmbedder({
  ...provider,
  model: env.EMBEDDING_MODEL,
  limiter: new RateLimiter(PROVIDER_LIMITS.EMBED),
});

const ingest: SubmitPorts = {
  sources: createSourceStorage(db),
  uploads: createUploadStorage(db),
  queue,
  assertCanCreate: createQuota(db),
  parse: createParseSource(pdfParser),
  embed: (texts) => embedder.embedDocuments(texts),
};

await queue.work(async (payload) => {
  const started = Date.now();
  await runIngestJob(payload, ingest);
  log({ level: 'info', msg: 'ingestion job done', durationMs: Date.now() - started });
});

const app = createApp({ auth, db, ingest, fetch: systemDeps });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log({ level: 'info', msg: 'listening', port: info.port });
});
