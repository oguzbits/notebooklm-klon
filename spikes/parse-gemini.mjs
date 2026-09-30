// Throwaway spike code (excluded from lint and check). Parses the corpus PDFs with a Gemini model.
// Run from your own terminal with the key loaded into GEMINI_API_KEY (see spikes/README.md):
//   node spikes/parse-gemini.mjs --model <model id> [--files 01,02] [--pause-ms 15000]
// The model ID comes from the command line, never from code. Sends public corpus PDFs to Google.
// Writes spikes/results/parse/<model>/<file>.md and <file>.json (time, tokens). Fails fast.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const PDF_FILES = [
  '01-dpr-paper-en.pdf',
  '02-destatis-arbeitsmarkt-de.pdf',
  '04-grundgesetz-auszug-de.pdf',
  '05-nist-ai-rmf-scan-en.pdf',
];
const PROMPT =
  'Transcribe this document completely into Markdown. Keep the reading order (for two-column ' +
  'pages read the left column first). Render tables as Markdown tables. Do not summarize, ' +
  'translate, omit or add anything. If a page is a scan, read the text as printed. Output only ' +
  'the transcription.';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const model = option('model');
if (!model) throw new Error('Pass --model <model id>');
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is not set');
const prefixes = option('files')?.split(',');
const pauseMs = Number(option('pause-ms', '15000'));

const corpus = new URL('./corpus/', import.meta.url);
const outDir = new URL(`./results/parse/${model}/`, import.meta.url);
mkdirSync(outDir, { recursive: true });

const files = PDF_FILES.filter((f) => !prefixes || prefixes.some((p) => f.startsWith(p)));
for (const [index, file] of files.entries()) {
  if (index > 0) await sleep(pauseMs);
  const data = readFileSync(new URL(file, corpus)).toString('base64');
  const started = performance.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inlineData: { mimeType: 'application/pdf', data } }, { text: PROMPT }],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    }
  );
  const seconds = (performance.now() - started) / 1000;
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status} ${await response.text()}`);
  const body = await response.json();
  const candidate = body.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
  writeFileSync(new URL(`${file}.md`, outDir), text);
  writeFileSync(
    new URL(`${file}.json`, outDir),
    JSON.stringify(
      { model, file, seconds, finishReason: candidate?.finishReason, usage: body.usageMetadata },
      null,
      2
    )
  );
  console.log(`${file}: ${seconds.toFixed(1)} s, ${text.length} chars, ${candidate?.finishReason}`);
}
