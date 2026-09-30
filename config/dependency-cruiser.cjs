/** @type {import('dependency-cruiser').IConfiguration} */
const SERVER_ONLY_PACKAGES =
  'node_modules/(drizzle-orm|drizzle-kit|pg|pg-boss|ai|@ai-sdk|@hono/node-server|better-auth)/';
const TEST_FILE = '\\.test\\.tsx?$';

module.exports = {
  forbidden: [
    {
      name: 'shared-imports-nothing-internal',
      comment: 'packages/shared is a leaf: it must not import from apps/*',
      severity: 'error',
      from: { path: '^packages/shared/src' },
      to: { path: '^apps/' },
    },
    {
      name: 'shared-only-depends-on-zod',
      comment:
        'packages/shared holds contracts only: no Node core modules, npm only zod (tests excepted)',
      severity: 'error',
      from: { path: '^packages/shared/src', pathNot: TEST_FILE },
      to: {
        dependencyTypes: ['core', 'npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg'],
        pathNot: ['node_modules/zod/', '^packages/shared/'],
      },
    },
    {
      name: 'api-not-web',
      comment: 'apps/api must not import from apps/web',
      severity: 'error',
      from: { path: '^apps/api/src' },
      to: { path: '^apps/web/' },
    },
    {
      name: 'web-not-api',
      comment:
        'apps/web must not import runtime code from apps/api. Only `import type` (Hono RPC AppType) is allowed.',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^apps/api/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'web-no-server-deps',
      comment: 'apps/web must not use server-only packages or Node core modules',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: SERVER_ONLY_PACKAGES },
    },
    {
      name: 'web-no-node-core',
      severity: 'error',
      from: { path: '^apps/web/src', pathNot: TEST_FILE },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'core-is-pure',
      comment: 'apps/api/src/core is pure logic: no routes, DB, jobs, AI providers or Hono',
      severity: 'error',
      from: { path: '^apps/api/src/core' },
      to: {
        path: [
          '^apps/api/src/(routes|db|jobs|ai|app|index)',
          SERVER_ONLY_PACKAGES,
          'node_modules/hono/',
        ],
      },
    },
    {
      name: 'web-hooks-not-components',
      comment: 'Hooks hold state and logic and must not depend on UI components',
      severity: 'error',
      from: { path: '^apps/web/src/hooks' },
      to: { path: '^apps/web/src/components' },
    },
    {
      name: 'web-no-types-from-components',
      comment: 'Types are defined in packages/shared or lib, not exported by components',
      severity: 'error',
      from: { path: '^apps/web/src/(lib|hooks)' },
      to: { path: '^apps/web/src/components', dependencyTypes: ['type-only'] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    exclude: { path: '^(apps|packages)/[^/]+/(dist|coverage)/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
