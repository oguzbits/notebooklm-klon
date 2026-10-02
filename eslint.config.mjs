import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const MODEL_ID_PATTERN = '^(gemini|gpt|claude)-';

const sharedRules = [
  {
    selector: 'CatchClause[param=null]',
    message: 'catch clauses must declare an error parameter and handle or log it.',
  },
  {
    selector:
      "CallExpression[callee.object.name='JSON'][callee.property.name='parse'] > CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message: 'Use structuredClone(value) instead of JSON.parse(JSON.stringify(value)).',
  },
  {
    selector:
      "TSAsExpression[typeAnnotation.typeName.name!='const'][expression.type='TSAsExpression']",
    message:
      "Double type assertion ('as unknown as X') is forbidden. Use a Zod schema or a type guard.",
  },
  {
    selector: 'ExportAllDeclaration',
    message: 'Wildcard re-exports (`export * from`) are forbidden. Use explicit named exports.',
  },
  {
    selector:
      'TSTypeAliasDeclaration[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.type="Identifier"]:not([typeAnnotation.typeArguments]):not([typeAnnotation.typeParameters]):not([typeParameters])',
    message: 'Redundant type alias (`type A = B`) is forbidden. Use the canonical type directly.',
  },
  {
    selector:
      'BinaryExpression[operator=/===|!==/] > Literal[value=/^[A-Z][A-Z0-9_]{2,}$/]:not([value=/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/])',
    message: 'Raw enum strings in comparisons are forbidden. Import the `as const` dictionary.',
  },
  {
    selector:
      "CallExpression[callee.object.name='z'][callee.property.name='literal'] > Literal[value=/^[A-Z][A-Z0-9_]{2,}$/]",
    message: 'Raw enum strings in z.literal() are forbidden. Use the `as const` dictionary.',
  },
];

const modelIdRule = {
  selector: `Literal[value=/${MODEL_ID_PATTERN}/]`,
  message: 'Model IDs live only in apps/api/src/config. Read them from the validated config.',
};

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/.claude/**',
    'reports/**',
    'spikes/**',
    'pnpm-lock.yaml',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: { 'unused-imports': unusedImports, 'simple-import-sort': simpleImportSort },
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true }],
      'no-restricted-syntax': ['error', ...sharedRules, modelIdRule],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Logs must never carry document content; the API logs structured lines only.
    files: ['apps/api/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // packages/shared holds contracts only: schemas, types and `as const` dictionaries.
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...sharedRules,
        modelIdRule,
        {
          selector: 'FunctionDeclaration, FunctionExpression, ClassDeclaration',
          message:
            'packages/shared has no implementation logic: only schemas, types and constants.',
        },
      ],
    },
  },
  {
    // Clean-code limits for application code. There is no suppression baseline: a violation fails.
    files: ['apps/*/src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.{ts,tsx}',
      '**/e2e/**',
      '**/eval/**',
      '**/testing/**',
      '**/components/ui/**',
    ],
    rules: {
      complexity: ['error', 10],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'no-nested-ternary': 'error',
    },
  },
  {
    // Every function of the database adapters starts with (db, userId, notebookId): the scope that
    // each query is filtered by (AGENTS.md, retrieval scope). With the payload that makes five.
    files: ['apps/api/src/db/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'max-params': ['error', 5] },
  },
  {
    // The single place where model IDs may appear.
    files: ['apps/api/src/config/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...sharedRules] },
  },
]);
