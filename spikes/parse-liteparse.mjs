// Throwaway spike code (excluded from lint and check). Parses the corpus PDFs locally with
// liteparse (no API key, no data leaves the machine except Tesseract language data on first run).
//   node spikes/parse-liteparse.mjs [--files 01,02]
// Writes spikes/results/parse/liteparse/<file>.md and <file>.json (time). Fails fast.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LiteParse } from '@llamaindex/liteparse';

const PDF_FILES = [
  '01-dpr-paper-en.pdf',
  '02-destatis-arbeitsmarkt-de.pdf',
  '04-grundgesetz-auszug-de.pdf',
  '05-nist-ai-rmf-scan-en.pdf',
];

const args = process.argv.slice(2);
const filesIndex = args.indexOf('--files');
const prefixes = filesIndex >= 0 ? args[filesIndex + 1].split(',') : undefined;

const corpus = new URL('./corpus/', import.meta.url);
const outDir = new URL('./results/parse/liteparse/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const parser = new LiteParse({ ocrEnabled: true });
for (const file of PDF_FILES.filter((f) => !prefixes || prefixes.some((p) => f.startsWith(p)))) {
  const started = performance.now();
  const result = await parser.parse(fileURLToPath(new URL(file, corpus)));
  const seconds = (performance.now() - started) / 1000;
  writeFileSync(new URL(`${file}.md`, outDir), result.text);
  writeFileSync(
    new URL(`${file}.json`, outDir),
    JSON.stringify({ tool: 'liteparse', file, seconds, pages: result.pages.length }, null, 2)
  );
  console.log(`${file}: ${seconds.toFixed(1)} s, ${result.text.length} chars`);
}
