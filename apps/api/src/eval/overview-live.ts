/**
 * The overview of a notebook against the real provider: `pnpm eval:overview`. It reads the demo
 * documents of apps/api/seed/demo into a notebook of a throwaway eval user, asks for the overview
 * through the same use case the route uses, and prints what came back: the symbol, how long the
 * summary is and how many key terms are in bold. It proves that the provider accepts the schema and
 * that the prompt gives what the screen needs. One model call of quota; the public demo texts go to
 * Google.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getOrCreateNotebookOverview } from '../chat/notebook-overview';
import { createNotebookOverviewPorts } from '../chat/notebook-overview-ports';
import { parseEnv } from '../config/env';
import { user } from '../db/auth-schema';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createNotebook, deleteNotebook } from '../db/notebook-repository';
import { importLocalFiles } from '../ingestion/local-import';
import { createLocalImportDeps } from '../ingestion/local-import-deps';
import { log } from '../logger';
import { createProviders } from '../providers';
import { toLocalFile } from './corpus';

const EVAL_USER_ID = 'eval-overview-user';
const DEMO_DIR = path.resolve(import.meta.dirname, '../../seed/demo');
const BOLD_TERM = /\*\*[^*]+\*\*/g;

const env = parseEnv(process.env);
await runMigrations(env.DATABASE_URL);
const { db, pool } = createDb(env.DATABASE_URL);
const providers = createProviders(env);

await db
  .insert(user)
  .values({ id: EVAL_USER_ID, name: 'Eval', email: 'eval-overview@example.invalid' })
  .onConflictDoNothing();
const notebook = await createNotebook(db, EVAL_USER_ID, 'Übersicht-Auswertung');

try {
  const files = readdirSync(DEMO_DIR)
    .sort()
    .map((name) => toLocalFile(name, new Uint8Array(readFileSync(path.join(DEMO_DIR, name)))));
  await importLocalFiles(
    { userId: EVAL_USER_ID, notebookId: notebook.id, files },
    createLocalImportDeps(db, providers)
  );

  const started = performance.now();
  const result = await getOrCreateNotebookOverview(
    { userId: EVAL_USER_ID, notebookId: notebook.id },
    createNotebookOverviewPorts(db, (input) => providers.stream(input))
  );
  const overview = result?.overview;
  if (!overview) throw new Error('No overview came back for the eval notebook.');
  log({
    level: 'info',
    msg: 'overview eval: result',
    emoji: overview.emoji,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    summaryChars: overview.summary.length,
    boldTerms: overview.summary.match(BOLD_TERM)?.length ?? 0,
    summary: overview.summary,
  });
} finally {
  await deleteNotebook(db, EVAL_USER_ID, notebook.id);
  await pool.end();
}
