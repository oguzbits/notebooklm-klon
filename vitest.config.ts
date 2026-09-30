import path from 'node:path';

import { defineConfig } from 'vitest/config';

const setupFiles = [path.resolve(import.meta.dirname, 'vitest.setup.ts')];

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', root: './packages/shared', environment: 'node', setupFiles } },
      { test: { name: 'api', root: './apps/api', environment: 'node', setupFiles } },
      { test: { name: 'web', root: './apps/web', environment: 'jsdom', setupFiles } },
    ],
  },
});
