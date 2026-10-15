import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Only the pure core tests: fast, no I/O. Used by `pnpm mutation` (StrykerJS), not by `pnpm test`.
// Paths hang off the working directory, not off this file: Stryker loads the config from the real
// project but runs from a sandbox copy, and tests must import the instrumented sandbox sources.
// The root stays the working directory because Stryker addresses test files relative to it.
export default defineConfig({
  test: {
    name: 'mutation-core',
    root: process.cwd(),
    environment: 'node',
    setupFiles: [path.resolve(process.cwd(), 'vitest.setup.ts')],
    include: ['apps/api/src/core/**/*.test.ts'],
  },
});
