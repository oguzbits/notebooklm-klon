#!/usr/bin/env node

/**
 * Writes the generated blocks of the docs from the code (limits, provider limits, environment
 * variables). `--check` writes nothing and fails when a block differs from the code.
 * Run through `pnpm docs:generate`, which loads the TypeScript config with tsx.
 */

import fs from 'node:fs';
import path from 'node:path';

import { EnvSchema } from '../../apps/api/src/config/env.ts';
import { LIMITS, PROVIDER_LIMITS } from '../../apps/api/src/config/limits.ts';
import { replaceBlocks, table } from './blocks.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TARGETS = ['docs/PLAN.md'];

function envStatus(schema) {
  if (schema.def.type === 'default') return 'default value';
  return schema.isOptional() ? 'optional' : 'required';
}

const BLOCKS = {
  limits: () =>
    table(
      ['Limit', 'Value'],
      Object.entries(LIMITS).map(([name, value]) => [`\`${name}\``, value.toLocaleString('en-US')])
    ),
  'provider-limits': () =>
    table(
      ['Role', 'Requests per minute', 'Tokens per minute'],
      Object.entries(PROVIDER_LIMITS).map(([role, v]) => [
        role,
        v.requestsPerMinute.toLocaleString('en-US'),
        v.tokensPerMinute.toLocaleString('en-US'),
      ])
    ),
  env: () =>
    table(
      ['Variable', 'Kind'],
      Object.entries(EnvSchema.shape).map(([name, schema]) => [`\`${name}\``, envStatus(schema)])
    ),
};

const check = process.argv.includes('--check');
const stale = [];
for (const target of TARGETS) {
  const file = path.join(ROOT, target);
  const before = fs.readFileSync(file, 'utf8');
  const after = replaceBlocks(before, (name) => BLOCKS[name]?.());
  if (after === before) continue;
  if (check) stale.push(target);
  else fs.writeFileSync(file, after);
}
if (stale.length > 0) {
  process.stderr.write(`Generated blocks differ from the code in: ${stale.join(', ')}\n`);
  process.stderr.write('Run `pnpm docs:generate` and commit the result.\n');
  process.exit(1);
}
process.stdout.write(check ? 'docs:generate ok\n' : 'docs:generate written\n');
