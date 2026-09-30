import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
  GEMINI_API_KEY: z.string().trim().min(1),
  // Model IDs come from the environment only. Code never names a model.
  AI_MODEL: z.string().trim().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates the raw environment. On failure the message lists variable names and reasons only,
 * never the received values, so secrets cannot leak into logs.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`
  );
  throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
}
