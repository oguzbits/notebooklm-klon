// Throwaway spike code (excluded from lint and check). Question: can the chat model find web sources with the
// Google Search tool, and do we get real links back (groundingChunks), also together with structured output?
//   node --env-file=.env.local spikes/websearch-probe.mjs
// The model ID comes from AI_MODEL in the environment, never from code. Sends one public search question to Google.
import { mkdirSync, writeFileSync } from 'node:fs';

const key = process.env.GEMINI_API_KEY;
const model = process.env.AI_MODEL;
if (!key || !model) throw new Error('GEMINI_API_KEY and AI_MODEL must be set');

const QUESTION =
  'Finde gute Webquellen (Wikipedia, Fachartikel, Dokumentation) zum Thema: Retrieval-Augmented Generation (RAG) bei Sprachmodellen.';
const SCHEMA = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['title', 'url', 'summary'],
      },
    },
  },
  required: ['sources'],
};

const VARIANTS = [
  { name: 'tool-only', config: {}, tools: [{ google_search: {} }] },
  {
    name: 'tool-with-json-schema',
    config: { responseMimeType: 'application/json', responseJsonSchema: SCHEMA },
    tools: [{ google_search: {} }],
  },
];

async function run(variant) {
  const started = Date.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: QUESTION }] }],
        tools: variant.tools,
        generationConfig: { temperature: 0, ...variant.config },
      }),
    }
  );
  const body = await response.json();
  if (!response.ok)
    return {
      variant: variant.name,
      status: response.status,
      error: JSON.stringify(body).slice(0, 500),
    };
  const candidate = body.candidates?.[0];
  const metadata = candidate?.groundingMetadata;
  return {
    variant: variant.name,
    status: response.status,
    ms: Date.now() - started,
    finish: candidate?.finishReason,
    queries: metadata?.webSearchQueries,
    chunks: (metadata?.groundingChunks ?? []).map((chunk) => ({
      uri: chunk.web?.uri?.slice(0, 120),
      title: chunk.web?.title,
    })),
    textSample: (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .slice(0, 700),
    usage: body.usageMetadata,
  };
}

const results = [];
for (const variant of VARIANTS) {
  results.push(await run(variant));
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
mkdirSync(new URL('./results', import.meta.url), { recursive: true });
writeFileSync(
  new URL('./results/websearch-probe.json', import.meta.url),
  JSON.stringify(results, null, 2)
);
console.log(JSON.stringify(results, null, 1));
