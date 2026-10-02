import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const API_DIR = path.resolve(import.meta.dirname, '..');
const BUNDLE_TIMEOUT_MS = 60_000;

describe('production bundle', () => {
  it(
    'loads as one ES module and stops at the environment check, not at a clash of imports',
    () => {
      execFileSync('pnpm', ['build'], { cwd: API_DIR, stdio: 'pipe' });

      // An empty environment: the start must reach the validation of the configuration.
      const started = spawnSync(process.execPath, ['dist/index.js'], {
        cwd: API_DIR,
        env: {},
        encoding: 'utf8',
        timeout: BUNDLE_TIMEOUT_MS,
      });

      expect(started.stderr).toContain('Invalid environment configuration');
      expect(started.stderr).not.toContain('SyntaxError');
    },
    BUNDLE_TIMEOUT_MS * 2
  );
});
