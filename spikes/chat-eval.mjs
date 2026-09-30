// Throwaway spike code (excluded from lint and check). Chat and citation spike: retrieves the top 5
// chunks with the cached embeddings, asks a model for statements with chunk IDs (structured
// output, streamed) and scores the citations.
//   node --env-file=.env.local spikes/chat-eval.mjs --model <id> --parse-dir <dir>
//     [--ids a,b,c] [--pause-ms 5000]
// The model ID comes from the command line, never from code. Sends public corpus text to Google.
// Needs the complete embedding cache of spikes/embed-eval.mjs (gemini-embedding-2, instruction).
// Raw responses are stored per question, so scoring can be replayed offline. Fails fast.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { buildChunks, here, loadGolden, normalize } from './lib.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const model = option('model');
const parseDir = option('parse-dir');
if (!model || !parseDir) throw new Error('Pass --model <id> --parse-dir <results/parse dir>');
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is not set');
const onlyIds = option('ids')?.split(',');
const pauseMs = Number(option('pause-ms', '5000'));
const TOP_K = 5;

const chunks = buildChunks(parseDir);
const golden = loadGolden().filter((q) => !onlyIds || onlyIds.includes(q.id));
const allGolden = loadGolden();

const cachePath = here('./results/embed/gemini-embedding-2-instruction/chunks.json');
if (!existsSync(cachePath)) throw new Error('Run embed-eval.mjs for gemini-embedding-2 first');
const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
if (cache.documents?.length !== chunks.length || cache.queries?.length !== allGolden.length) {
  throw new Error('Embedding cache does not match the current chunks or questions');
}
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

const SYSTEM =
  'You answer questions about the user documents. Use ONLY the numbered context passages. ' +
  'Answer in the language of the question. Split the answer into short statements. Every ' +
  'statement must cite one or more passage IDs (for example "c2") from the context and must be ' +
  'supported by the cited passages. Never cite an ID that is not in the context. If the context ' +
  'does not contain the answer, return one statement saying so with an empty citation list.';

const SCHEMA = {
  type: 'object',
  properties: {
    statements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          chunkIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'chunkIds'],
      },
    },
  },
  required: ['statements'],
};

async function ask(question, context) {
  const prompt = `${context.map((c) => `[${c.id}]\n${c.text}`).join('\n\n')}\n\nQuestion: ${question}`;
  const started = performance.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: SCHEMA,
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);

  let firstTokenMs = null;
  let text = '';
  let usage;
  let finishReason;
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const part of response.body) {
    buffer += decoder.decode(part, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      const event = JSON.parse(line.slice(5));
      const candidate = event.candidates?.[0];
      const piece = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      if (piece && firstTokenMs === null) firstTokenMs = performance.now() - started;
      text += piece;
      usage = event.usageMetadata ?? usage;
      finishReason = candidate?.finishReason ?? finishReason;
    }
  }
  return { text, usage, finishReason, firstTokenMs, totalMs: performance.now() - started };
}

const outDir = here(`./results/chat/${model}/`);
mkdirSync(outDir, { recursive: true });

for (const [n, question] of golden.entries()) {
  if (n > 0) await sleep(pauseMs);
  const queryVector = cache.queries[allGolden.findIndex((q) => q.id === question.id)];
  const top = cache.documents
    .map((vector, index) => ({ index, score: dot(queryVector, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map(({ index }, rank) => ({ id: `c${rank + 1}`, text: chunks[index].text }));
  const result = await ask(question.question, top);
  writeFileSync(
    new URL(`${question.id}.json`, outDir),
    JSON.stringify({ model, id: question.id, context: top, ...result }, null, 2)
  );
  console.log(
    `${question.id}: ttft ${((result.firstTokenMs ?? NaN) / 1000).toFixed(1)} s, total ${(result.totalMs / 1000).toFixed(1)} s, ${result.finishReason}`
  );
}
