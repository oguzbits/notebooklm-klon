// Throwaway spike code (excluded from lint and check). Omission check for parsed corpus files:
// how many golden anchors of a source file appear literally in the parsed text?
//   node spikes/score-parse.mjs <results dir name, e.g. the model id>
// Same normalization as apps/api/src/eval/scorers.ts (NFKC, lower case, collapsed whitespace).
import { readdirSync, readFileSync } from 'node:fs';

const name = process.argv[2];
if (!name) throw new Error('Pass the results directory name');

const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const golden = JSON.parse(
  readFileSync(new URL('../apps/api/src/eval/golden-questions.json', import.meta.url), 'utf8')
);
const dir = new URL(`./results/parse/${name}/`, import.meta.url);

for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const source = file.replace(/\.md$/, '');
  const parsed = normalize(readFileSync(new URL(file, dir), 'utf8'));
  const anchors = golden.flatMap((q) =>
    q.expectedAnchors.filter((a) => a.sourceFile === source).map((a) => ({ id: q.id, ...a }))
  );
  const missing = anchors.filter((a) => !parsed.includes(normalize(a.text)));
  console.log(`${source}: ${anchors.length - missing.length}/${anchors.length} anchors found`);
  for (const a of missing) console.log(`  missing (${a.id}): ${a.text}`);
}
