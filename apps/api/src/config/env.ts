import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;

export const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export const EnvSchema = DatabaseEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  GEMINI_API_KEY: z.string().trim().min(1),
  // Model IDs come from the environment only. Code never names a model.
  AI_MODEL: z.string().trim().min(1),
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
