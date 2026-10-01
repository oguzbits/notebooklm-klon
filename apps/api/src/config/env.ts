import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;
const MIN_AUTH_SECRET_CHARS = 32;
const MIN_PASSWORD_CHARS = 8;

export const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export const EnvSchema = DatabaseEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  GEMINI_API_KEY: z.string().trim().min(1),
  // Model IDs come from the environment only. Code never names a model.
  AI_MODEL: z.string().trim().min(1),
  PARSE_MODEL: z.string().trim().min(1),
  // Optional. Reads a PDF again when PARSE_MODEL was blocked as recitation.
  PARSE_FALLBACK_MODEL: z.string().trim().min(1).optional(),
  EMBEDDING_MODEL: z.string().trim().min(1),
  // Signs the session cookies. Generate one with `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: z.string().trim().min(MIN_AUTH_SECRET_CHARS),
  // Public origin of the app, also the only origin allowed to send authenticated requests.
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  // Optional. Key of the web search (Tavily). Without it the search box is not offered.
  TAVILY_API_KEY: z.string().trim().min(1).optional(),
  // Folder of the built web app. Set: the API serves it (one container). Unset: API only.
  WEB_DIST_DIR: z.string().trim().min(1).optional(),
  // Only for `pnpm seed:demo`: the account of the example notebook. Both or neither.
  SEED_DEMO_EMAIL: z.email().optional(),
  SEED_DEMO_PASSWORD: z.string().min(MIN_PASSWORD_CHARS).optional(),
});

// The database tests reset the whole schema, so they refuse any database not named *_test.
const LOCAL_TEST_DATABASE_URL = 'postgresql://nlm:nlm@localhost:54329/nlm_test';

export const TestDatabaseEnvSchema = z.object({
  TEST_DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .refine((url) => new URL(url).pathname.endsWith('_test'), {
      message: 'must point to a database whose name ends with _test',
    })
    .default(LOCAL_TEST_DATABASE_URL),
});

// The offline server (Playwright, manual UI checks) fakes the model and the embedding, so it needs
// no API key and no model IDs.
export const OfflineServerEnvSchema = EnvSchema.pick({
  DATABASE_URL: true,
  PORT: true,
  BETTER_AUTH_SECRET: true,
  BETTER_AUTH_URL: true,
  WEB_DIST_DIR: true,
});

export type Env = z.infer<typeof EnvSchema>;
export type DatabaseEnv = z.infer<typeof DatabaseEnvSchema>;

/**
 * Validates a raw environment. On failure the message lists variable names and reasons only,
 * never the received values, so secrets cannot leak into logs.
 */
function parse<T extends z.ZodType>(
  schema: T,
  raw: Record<string, string | undefined>
): z.infer<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`
  );
  throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  return parse(EnvSchema, raw);
}

/** For scripts that only touch the database (migrations) and need no API keys. */
export function parseDatabaseEnv(raw: Record<string, string | undefined>): DatabaseEnv {
  return parse(DatabaseEnvSchema, raw);
}

export function parseTestDatabaseEnv(raw: Record<string, string | undefined>) {
  return parse(TestDatabaseEnvSchema, raw);
}

export function parseOfflineServerEnv(raw: Record<string, string | undefined>) {
  return parse(OfflineServerEnvSchema, raw);
}
