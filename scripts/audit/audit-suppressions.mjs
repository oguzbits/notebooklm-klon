#!/usr/bin/env node

/**
 * Suppression ratchet.
 *
 * `eslint-suppressions.json` freezes the clean-code violations that were there when the limits were
 * switched on. It may only get smaller. The number below is the most it may hold: when a violation
 * is fixed, run `pnpm lint:prune` and lower the number to the new total. Raising it, or running
 * `eslint --suppress-all` again, is exactly what this check is here to stop.
 */

import fs from 'node:fs';

const MAX_SUPPRESSED = 16;
const FILE = 'eslint-suppressions.json';

const suppressions = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const total = Object.values(suppressions)
  .flatMap((rules) => Object.values(rules))
  .reduce((sum, rule) => sum + rule.count, 0);

if (total > MAX_SUPPRESSED) {
  console.error(
    `${FILE} holds ${total} suppressions, more than the ${MAX_SUPPRESSED} it may. Fix the new violation instead of freezing it.`
  );
  process.exit(1);
}
if (total < MAX_SUPPRESSED) {
  console.error(
    `${FILE} holds only ${total} suppressions: lower MAX_SUPPRESSED in scripts/audit/audit-suppressions.mjs to ${total} so nobody can add them back.`
  );
  process.exit(1);
}
console.log(`audit:suppressions ok (${total} frozen, may only go down)`);
