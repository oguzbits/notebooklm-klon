/**
 * The golden questions against the real providers: `pnpm eval:live`. It reads the spike corpus
 * (spikes/corpus, see its README), reads it into a notebook of a throwaway eval user with the real
 * ingestion (known content is reused, so only the first run pays for parsing and embedding), asks
 * the 18 questions through the same code as the chat and prints how well retrieval, answers and
 * citations did. It costs quota and sends the public corpus to Google. Not part of `pnpm test`.
 *
 *   pnpm eval:live [--ids a,b] [--pause-ms 4000] [--corpus <dir>]
 *
 * The report (JSON with the answers, and Markdown) goes to reports/, which git ignores.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { parseEnv } from '../config/env';
import { user } from '../db/auth-schema';
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createNotebook, deleteNotebook, selectedReadySourceIds } from '../db/notebook-repository';
import { searchChunks } from '../db/retrieval';
import { importLocalFiles } from '../ingestion/local-import';
import { createLocalImportDeps } from '../ingestion/local-import-deps';
import { log } from '../logger';
import { createProviders } from '../providers';
import { toLocalFile } from './corpus';
import { EvalDatasetSchema } from './dataset';
import { formatReport } from './report';
import { type QuestionResult, runQuestion, summarize } from './run';

const EVAL_USER_ID = 'eval-user';
const DEFAULT_PAUSE_MS = 4000;
const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const env = parseEnv(process.env);
const corpusDir = path.resolve(option('corpus') ?? path.join(REPO_ROOT, 'spikes/corpus'));
const onlyIds = option('ids')?.split(',');
const pauseMs = Number(option('pause-ms') ?? DEFAULT_PAUSE_MS);

const dataset = EvalDatasetSchema.parse(
  JSON.parse(readFileSync(path.join(import.meta.dirname, 'golden-questions.json'), 'utf8'))
);
const questions = dataset.filter((question) => !onlyIds || onlyIds.includes(question.id));
if (questions.length === 0) throw new Error('No golden question matches --ids.');

await runMigrations(env.DATABASE_URL);
const { db, pool } = createDb(env.DATABASE_URL);
const providers = createProviders(env);

await db
  .insert(user)
  .values({ id: EVAL_USER_ID, name: 'Eval', email: 'eval@example.invalid' })
  .onConflictDoNothing();
const notebook = await createNotebook(db, EVAL_USER_ID, 'Eval');

try {
  const fileNames = [
    ...new Set(questions.flatMap((q) => q.expectedAnchors.map((a) => a.sourceFile))),
  ];
  const files = fileNames.map((name) =>
    toLocalFile(name, new Uint8Array(readFileSync(path.join(corpusDir, name))))
  );
  log({ level: 'info', msg: 'eval: reading corpus', files: files.length });

  await importLocalFiles(
    { userId: EVAL_USER_ID, notebookId: notebook.id, files },
    createLocalImportDeps(db, providers)
  );

  const scope = {
    userId: EVAL_USER_ID,
    notebookId: notebook.id,
    sourceIds: await selectedReadySourceIds(db, EVAL_USER_ID, notebook.id),
  };
  const ports = {
    embedQuery: providers.embedQuery,
    search: (request: Parameters<typeof searchChunks>[1]) => searchChunks(db, request),
    stream: providers.stream,
    onError: (error: unknown) =>
      log({
        level: 'error',
        msg: 'eval: model failed',
        name: error instanceof Error ? error.name : '',
      }),
  };

  const results: QuestionResult[] = [];
  for (const question of questions) {
    const result = await runQuestion(question, scope, ports);
    results.push(result);
    log({
      level: 'info',
      msg: 'eval: question done',
      id: result.id,
      hit: result.retrieval.hit,
      failure: result.failure,
    });
    await sleep(pauseMs);
  }

  const summary = summarize(results);
  const markdown = formatReport(results, summary);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const reports = path.join(REPO_ROOT, 'reports');
  mkdirSync(reports, { recursive: true });
  writeFileSync(
    path.join(reports, `eval-live-${stamp}.json`),
    JSON.stringify({ summary, results }, null, 2)
  );
  writeFileSync(path.join(reports, `eval-live-${stamp}.md`), `${markdown}\n`);
  process.stdout.write(`\n${markdown}\n\nReport: reports/eval-live-${stamp}.md\n`);
} finally {
  await deleteNotebook(db, EVAL_USER_ID, notebook.id);
  await pool.end();
}
