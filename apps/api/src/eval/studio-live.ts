/**
 * The Studio against the real providers: `pnpm eval:studio`. It reads the demo documents of
 * apps/api/seed/demo into a notebook of a throwaway eval user, makes one output of every kind with
 * the model from the environment and prints what came back: how many parts, how many the server
 * dropped for want of a citation. It proves that the provider accepts the schemas and that the
 * output holds up. It uses a few model calls of quota and sends the public demo texts to Google.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  type CreateStudioBody,
  REPORT_FORMAT,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
} from '@nlm/shared';

import { parseEnv } from '../config/env';
import { LIMITS } from '../config/limits';
import { readStudioReply, studioRequest } from '../core/studio-prompt';
import { user } from '../db/auth-schema';
import { getChatConfig } from '../db/chat-config-repository';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createNotebook, deleteNotebook } from '../db/notebook-repository';
import { loadStudioChunks } from '../db/studio-repository';
import { importLocalFiles } from '../ingestion/local-import';
import { createLocalImportDeps } from '../ingestion/local-import-deps';
import { log } from '../logger';
import { createProviders } from '../providers';
import { toLocalFile } from './corpus';

const EVAL_USER_ID = 'eval-studio-user';
const DEMO_DIR = path.resolve(import.meta.dirname, '../../seed/demo');

const REQUESTS: CreateStudioBody[] = [
  { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.BRIEFING },
  { kind: STUDIO_KIND.FLASHCARDS, size: STUDIO_SIZE.DEFAULT, difficulty: STUDIO_DIFFICULTY.MEDIUM },
  { kind: STUDIO_KIND.QUIZ, size: STUDIO_SIZE.DEFAULT, difficulty: STUDIO_DIFFICULTY.MEDIUM },
  { kind: STUDIO_KIND.MINDMAP },
  { kind: STUDIO_KIND.DATA_TABLE },
];

const env = parseEnv(process.env);
await runMigrations(env.DATABASE_URL);
const { db, pool } = createDb(env.DATABASE_URL);
const providers = createProviders(env);

await db
  .insert(user)
  .values({ id: EVAL_USER_ID, name: 'Eval', email: 'eval-studio@example.invalid' })
  .onConflictDoNothing();
const notebook = await createNotebook(db, EVAL_USER_ID, 'Studio-Auswertung');

try {
  const files = readdirSync(DEMO_DIR)
    .sort()
    .map((name) => toLocalFile(name, new Uint8Array(readFileSync(path.join(DEMO_DIR, name)))));
  await importLocalFiles(
    { userId: EVAL_USER_ID, notebookId: notebook.id, files },
    createLocalImportDeps(db, providers)
  );

  const chunks = await loadStudioChunks(db, EVAL_USER_ID, notebook.id, LIMITS.STUDIO_MAX_CHARS);
  const config = await getChatConfig(db, EVAL_USER_ID, notebook.id);
  if (!config) throw new Error('The eval notebook vanished.');
  log({ level: 'info', msg: 'studio eval: context', chunks: chunks.length });

  for (const body of REQUESTS) {
    const request = studioRequest(body, chunks, config.language);
    const started = performance.now();
    let reply = '';
    for await (const piece of providers.stream({
      system: request.system,
      user: request.user,
      schema: request.schema,
    })) {
      reply += piece;
    }
    const { output, dropped } = readStudioReply(body, reply, request.context);
    log({
      level: 'info',
      msg: 'studio eval: output',
      kind: body.kind,
      seconds: Math.round((performance.now() - started) / 100) / 10,
      replyChars: reply.length,
      dropped,
      title: output.title,
    });
  }
} finally {
  await deleteNotebook(db, EVAL_USER_ID, notebook.id);
  await pool.end();
}
