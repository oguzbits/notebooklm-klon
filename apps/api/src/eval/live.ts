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
import { createNotebook, deleteNotebook } from '../db/notebook-repository';
import { selectedReadySourceIds } from '../db/notebook-source-repository';
import { searchChunks } from '../db/retrieval';
import { importLocalFiles } from '../ingestion/local-import';
import { createLocalImportDeps } from '../ingestion/local-import-deps';
import { log } from '../logger';
import { createProviders } from '../providers';
import { toLocalFile } from './corpus';
import { EvalDatasetSchema, questionSourceFiles } from './dataset';
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

/** The message at the end of the cause chain, e.g. the finish reason behind an ingest error. */
function rootMessage(error: unknown): string {
  if (!(error instanceof Error)) return '';
  return error.cause instanceof Error ? rootMessage(error.cause) : error.message;
}

const env = parseEnv(process.env);
const corpusDir = path.resolve(option('corpus') ?? path.join(REPO_ROOT, 'spikes/corpus'));
const onlyIds = option('ids')?.split(',');
const pauseMs = Number(option('pause-ms') ?? DEFAULT_PAUSE_MS);

const dataset = EvalDatasetSchema.parse(
  JSON.parse(readFileSync(path.join(import.meta.dirname, 'golden-questions.json'), 'utf8'))
);
const selected = dataset.filter((question) => !onlyIds || onlyIds.includes(question.id));
if (selected.length === 0) throw new Error('No golden question matches --ids.');

await runMigrations(env.DATABASE_URL);
const { db, pool } = createDb(env.DATABASE_URL);
const providers = createProviders(env);

await db
  .insert(user)
  .values({ id: EVAL_USER_ID, name: 'Eval', email: 'eval@example.invalid' })
  .onConflictDoNothing();
const notebook = await createNotebook(db, EVAL_USER_ID, 'Eval');

try {
  const fileNames = [...new Set(selected.flatMap(questionSourceFiles))];
  log({ level: 'info', msg: 'eval: reading corpus', files: fileNames.length });

  // One file at a time: a file the models refuse (seen with the scanned NIST paper, which ends in
  // RECITATION) must not stop the run. It is named in the report, and its questions are left out
  // instead of being scored as misses. A FAILED source is read again by the next run.
  const deps = createLocalImportDeps(db, providers);
  const unreadable: string[] = [];
  for (const name of fileNames) {
    const file = toLocalFile(name, new Uint8Array(readFileSync(path.join(corpusDir, name))));
    try {
      await importLocalFiles(
        { userId: EVAL_USER_ID, notebookId: notebook.id, files: [file] },
        deps
      );
    } catch (error) {
      unreadable.push(name);
      log({
        level: 'error',
        msg: 'eval: file not readable',
        file: name,
        reason: rootMessage(error),
      });
    }
  }
  const questions = selected.filter((q) =>
    questionSourceFiles(q).every((file) => !unreadable.includes(file))
  );
  if (questions.length === 0) throw new Error('No corpus file could be read.');

  const scope = {
    userId: EVAL_USER_ID,
    notebookId: notebook.id,
    sourceIds: await selectedReadySourceIds(db, EVAL_USER_ID, notebook.id),
  };
  // A source that is not ready would silently lower every score that depends on it.
  const expectedReady = fileNames.length - unreadable.length;
  if (scope.sourceIds.length !== expectedReady) {
    throw new Error(`Only ${scope.sourceIds.length} of ${expectedReady} corpus files are ready.`);
  }
  const ports = {
    embedQuery: providers.embedQuery,
    translateQuery: providers.translateQuery,
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
      hit: result.retrieval?.hit ?? null,
      failure: result.failure,
    });
    await sleep(pauseMs);
  }

  const summary = summarize(results);
  const notRead =
    unreadable.length === 0
      ? ''
      : `\n\nNicht gelesen (die Fragen dazu fehlen oben): ${unreadable.join(', ')}`;
  const markdown = `${formatReport(results, summary)}${notRead}`;
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
