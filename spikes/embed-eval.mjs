// Throwaway spike code (excluded from lint and check). Compares embedding models on retrieval:
// is a chunk that contains a golden anchor among the top 5 for the question?
//   node --env-file=.env.local spikes/embed-eval.mjs --model <model id> --style <instruction|task-type>
// The model ID comes from the command line, never from code. Sends public corpus text to Google.
// Style "instruction": task written into the text ("task: search result | query: ..."), no
// taskType (the documented form for the newer model). Style "task-type": taskType field.
// Chunks come from the winning Parsing output (PDFs) and the extracted reference text (others).
// Throttled by estimated tokens (free tier: 30K per minute). Embeddings are cached per model, so
// a rerun continues where it stopped. Fails fast on any HTTP error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { buildChunks, here, loadGolden, normalize } from './lib.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const model = option('model');
const style = option('style');
const parseDir = option('parse-dir');
if (!model || !['instruction', 'task-type'].includes(style) || !parseDir) {
  throw new Error(
    'Pass --model <id> --style <instruction|task-type> --parse-dir <results/parse dir>'
  );
}
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is not set');

const DIMENSIONS = 768;
const TOP_K = 5;
const BATCH_SIZE = 16;
const TOKENS_PER_MINUTE = 24000; // safety margin under 30K
const CHARS_PER_TOKEN = 3; // conservative estimate

const chunks = buildChunks(parseDir);
const golden = loadGolden();

const formatDocument = (text) => (style === 'instruction' ? `title: none | text: ${text}` : text);
const formatQuery = (text) =>
  style === 'instruction' ? `task: search result | query: ${text}` : text;

const window = [];
async function throttle(tokens) {
  for (;;) {
    const now = Date.now();
    while (window.length > 0 && now - window[0].at > 60000) window.shift();
    const used = window.reduce((sum, entry) => sum + entry.tokens, 0);
    if (used + tokens <= TOKENS_PER_MINUTE || window.length === 0) break;
    await sleep(window[0].at + 60000 - now + 250);
  }
  window.push({ at: Date.now(), tokens });
}

function normalizeVector(values) {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return values.map((v) => v / norm);
}

async function embedBatch(texts, taskType) {
  await throttle(texts.reduce((sum, t) => sum + Math.ceil(t.length / CHARS_PER_TOKEN), 0));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          outputDimensionality: DIMENSIONS,
          ...(style === 'task-type' ? { taskType } : {}),
        })),
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
  const body = await response.json();
  if (body.embeddings?.length !== texts.length) {
    throw new Error(`expected ${texts.length} embeddings, got ${body.embeddings?.length}`);
  }
  return body.embeddings.map((e) => {
    if (e.values.length !== DIMENSIONS) throw new Error(`got ${e.values.length} dimensions`);
    return normalizeVector(e.values);
  });
}

const outDir = here(`./results/embed/${model}-${style}/`);
mkdirSync(outDir, { recursive: true });
const cachePath = new URL('chunks.json', outDir);
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

async function embedAll(items, taskType, cacheKey) {
  const vectors = cache[cacheKey] ?? [];
  while (vectors.length < items.length) {
    const batch = items.slice(vectors.length, vectors.length + BATCH_SIZE);
    vectors.push(...(await embedBatch(batch, taskType)));
    cache[cacheKey] = vectors;
    writeFileSync(cachePath, JSON.stringify(cache));
    console.log(`${cacheKey}: ${vectors.length}/${items.length}`);
  }
  return vectors;
}

console.log(`${chunks.length} chunks, ${golden.length} questions, model ${model}, style ${style}`);
const chunkVectors = await embedAll(
  chunks.map((c) => formatDocument(c.text)),
  'RETRIEVAL_DOCUMENT',
  'documents'
);
const queryVectors = await embedAll(
  golden.map((q) => formatQuery(q.question)),
  'RETRIEVAL_QUERY',
  'queries'
);

const normalizedChunks = chunks.map((c) => normalize(c.text));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const rows = [];
for (const [i, question] of golden.entries()) {
  const anchors = question.expectedAnchors.map((a) => normalize(a.text));
  const anchorInCorpus = anchors.map((a) => normalizedChunks.some((c) => c.includes(a)));
  const ranked = chunkVectors
    .map((vector, index) => ({ index, score: dot(queryVectors[i], vector) }))
    .sort((a, b) => b.score - a.score);
  const firstRank = ranked.findIndex(({ index }) =>
    anchors.some((a) => normalizedChunks[index].includes(a))
  );
  const top = ranked.slice(0, TOP_K).map(({ index }) => normalizedChunks[index]);
  rows.push({
    id: question.id,
    language: question.language,
    sourceLanguage: question.expectedAnchors[0].sourceFile.match(/-(de|en)\./)?.[1],
    rank: firstRank >= 0 ? firstRank + 1 : null,
    hit: firstRank >= 0 && firstRank < TOP_K,
    anchorRecall: anchors.filter((a) => top.some((c) => c.includes(a))).length / anchors.length,
    anchorMissingInChunks: anchorInCorpus.includes(false),
  });
}

const share = (list) => (list.length ? `${list.filter((r) => r.hit).length}/${list.length}` : '-');
console.log(`\nTop-${TOP_K}-Treffer gesamt: ${share(rows)}`);
console.log(
  `deutsche Frage, deutsche Quelle: ${share(rows.filter((r) => r.language === 'de' && r.sourceLanguage === 'de'))}`
);
console.log(
  `deutsche Frage, englische Quelle: ${share(rows.filter((r) => r.language === 'de' && r.sourceLanguage === 'en'))}`
);
console.log(`englische Frage, englische Quelle: ${share(rows.filter((r) => r.language === 'en'))}`);
for (const r of rows) {
  console.log(
    `${r.hit ? 'ok  ' : 'MISS'} ${r.id} rank=${r.rank ?? '-'} recall=${r.anchorRecall.toFixed(2)}${r.anchorMissingInChunks ? ' (Anker steht in keinem Chunk!)' : ''}`
  );
}
writeFileSync(new URL('summary.json', outDir), JSON.stringify(rows, null, 2));
