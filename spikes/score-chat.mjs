// Throwaway spike code (excluded from lint and check). Scores stored chat responses offline.
//   node spikes/score-chat.mjs <results/chat dir name, e.g. the model id>
// Same definitions as apps/api/src/eval/scorers.ts: validity = valid citations / citations,
// coverage = statements with at least one valid citation / statements. Plus:
//   facts: required facts found in the answer text (literal, normalized)
//   supported: required facts that also appear in a chunk cited by the answer (citation carries it)
import { readdirSync, readFileSync } from 'node:fs';

import { here, loadGolden, normalize } from './lib.mjs';

const name = process.argv[2];
if (!name) throw new Error('Pass the results directory name');
const golden = loadGolden();
const dir = here(`./results/chat/${name}/`);

const total = {
  citations: 0,
  invalid: 0,
  statements: 0,
  covered: 0,
  facts: 0,
  found: 0,
  supported: 0,
};
const ttft = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const run = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  const question = golden.find((q) => q.id === run.id);
  let statements;
  try {
    statements = JSON.parse(run.text).statements;
  } catch {
    console.log(`${run.id}: INVALID JSON (${run.finishReason})`);
    continue;
  }
  const contextIds = new Set(run.context.map((c) => c.id));
  const citations = statements.flatMap((s) => s.chunkIds);
  const invalid = citations.filter((id) => !contextIds.has(id)).length;
  const covered = statements.filter((s) => s.chunkIds.some((id) => contextIds.has(id))).length;
  const answer = normalize(statements.map((s) => s.text).join(' '));
  const citedText = normalize(
    run.context
      .filter((c) => citations.includes(c.id))
      .map((c) => c.text)
      .join(' ')
  );
  const facts = question.requiredFacts.map(normalize);
  const found = facts.filter((f) => answer.includes(f));
  const supported = found.filter((f) => citedText.includes(f));
  Object.assign(total, {
    citations: total.citations + citations.length,
    invalid: total.invalid + invalid,
    statements: total.statements + statements.length,
    covered: total.covered + covered,
    facts: total.facts + facts.length,
    found: total.found + found.length,
    supported: total.supported + supported.length,
  });
  if (run.firstTokenMs) ttft.push(run.firstTokenMs / 1000);
  const missing = facts.filter((f) => !answer.includes(f));
  console.log(
    `${run.id}: statements ${statements.length}, invalid citations ${invalid}, uncovered ${statements.length - covered}, facts ${found.length}/${facts.length}, supported ${supported.length}${missing.length ? `, missing: ${missing.join(' | ')}` : ''}`
  );
}
const pct = (a, b) => (b === 0 ? 'n/a' : `${((100 * a) / b).toFixed(0)} %`);
ttft.sort((a, b) => a - b);
console.log(
  `\nvalidity ${pct(total.citations - total.invalid, total.citations)}, coverage ${pct(total.covered, total.statements)}, facts ${pct(total.found, total.facts)}, supported ${pct(total.supported, total.facts)}`
);
if (ttft.length) {
  console.log(
    `time to first token: median ${ttft[Math.floor(ttft.length / 2)].toFixed(1)} s, max ${ttft.at(-1).toFixed(1)} s (n=${ttft.length})`
  );
}
