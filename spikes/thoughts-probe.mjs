// Throwaway spike code (excluded from lint and check). Question: does the chat model return thought
// summaries (includeThoughts) together with our structured JSON output while streaming, and are they useful?
//   node --env-file=.env.local spikes/thoughts-probe.mjs
// The model ID comes from AI_MODEL in the environment, never from code. Sends two public sentences to Google.
import { mkdirSync, writeFileSync } from 'node:fs';

const key = process.env.GEMINI_API_KEY;
const model = process.env[process.env.PROBE_MODEL_VAR ?? 'AI_MODEL'];
if (!key || !model) throw new Error('GEMINI_API_KEY and AI_MODEL must be set');

const SYSTEM =
  'You answer questions about the user documents. Use ONLY the numbered context passages. ' +
  'Answer in the language of the question. Split the answer into short statements. Every ' +
  'statement must cite one or more passage IDs (for example "c1") from the context.';
const USER =
  'Context:\n[c1] Jev is a model by TypeSafe AI released in September 2026. It returns typed values such as choices or probabilities instead of free text.\n' +
  '[c2] Jev was evaluated against eleven other configurations and reached full semantic correctness with the lowest latency and cost.\n\n' +
  'Question: Wie unterscheidet sich Jev von klassischen Sprachmodellen und wie schnitt es in der Studie ab?';
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

const VARIANTS = [
  { name: 'includeThoughts-only', thinkingConfig: { includeThoughts: true } },
  {
    name: 'includeThoughts-medium',
    thinkingConfig: { includeThoughts: true, thinkingLevel: 'medium' },
  },
  {
    name: 'includeThoughts-high',
    thinkingConfig: { includeThoughts: true, thinkingLevel: 'high' },
  },
];

async function run(variant) {
  const started = Date.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: USER }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: SCHEMA,
          ...(variant.thinkingConfig && { thinkingConfig: variant.thinkingConfig }),
        },
      }),
    }
  );
  if (!response.ok) {
    return {
      variant: variant.name,
      status: response.status,
      error: (await response.text()).slice(0, 400),
    };
  }
  const parts = [];
  let usage;
  let finish;
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const event = JSON.parse(line.slice(5));
      const candidate = event.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        parts.push({
          thought: part.thought === true,
          text: part.text ?? '',
          at: Date.now() - started,
        });
      }
      finish = candidate?.finishReason ?? finish;
      usage = event.usageMetadata ?? usage;
    }
  }
  const thoughts = parts.filter((p) => p.thought);
  const answer = parts
    .filter((p) => !p.thought)
    .map((p) => p.text)
    .join('');
  let answerValid = false;
  try {
    answerValid = Array.isArray(JSON.parse(answer).statements);
  } catch {
    answerValid = false;
  }
  return {
    variant: variant.name,
    status: response.status,
    finish,
    ms: Date.now() - started,
    thoughtParts: thoughts.length,
    thoughtChars: thoughts.reduce((n, p) => n + p.text.length, 0),
    firstThoughtAtMs: thoughts[0]?.at ?? null,
    firstAnswerAtMs: parts.find((p) => !p.thought)?.at ?? null,
    answerIsValidJson: answerValid,
    usage,
    thoughtSample: thoughts
      .map((p) => p.text)
      .join('\n---\n')
      .slice(0, 900),
  };
}

const results = [];
for (const variant of VARIANTS) {
  results.push(await run(variant));
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
mkdirSync(new URL('./results', import.meta.url), { recursive: true });
writeFileSync(
  new URL(
    `./results/thoughts-probe-${process.env.PROBE_MODEL_VAR ?? 'AI_MODEL'}.json`,
    import.meta.url
  ),
  JSON.stringify(results, null, 2)
);
for (const r of results) {
  console.log(JSON.stringify({ ...r, thoughtSample: r.thoughtSample?.slice(0, 500) }, null, 1));
}
