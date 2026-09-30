import path from 'node:path';

import { configDefaults, defineConfig } from 'vitest/config';

const setupFiles = [path.resolve(import.meta.dirname, 'vitest.setup.ts')];
const DB_TESTS = '**/*.db.test.ts';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', root: './packages/shared', environment: 'node', setupFiles } },
      {
        test: {
          name: 'api',
          root: './apps/api',
          environment: 'node',
          setupFiles,
          exclude: [...configDefaults.exclude, DB_TESTS],
        },
      },
      { test: { name: 'hooks', root: './.claude/hooks', environment: 'node', setupFiles } },
      { test: { name: 'web', root: './apps/web', environment: 'jsdom', setupFiles } },
      {
        // Needs a running Postgres with pgvector: `pnpm db:up`. Not part of `pnpm test`.
        test: {
          name: 'db',
          root: './apps/api',
          environment: 'node',
          include: [DB_TESTS],
          globalSetup: [
            path.resolve(import.meta.dirname, 'apps/api/src/db/testing/global-setup.ts'),
          ],
          fileParallelism: false,
        },
      },
    ],
  },
});
