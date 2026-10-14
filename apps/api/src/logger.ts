import { SOURCE_KIND } from '@nlm/shared';
import { z } from 'zod';

/**
 * Fields that mean the same in every log line. Typed, so a line cannot carry them under another name
 * or with another type (a file name is not among them: see `log`).
 */
export const LogContextSchema = z.object({
  requestId: z.string(),
  userId: z.string(),
  sourceId: z.string(),
  kind: z.enum(SOURCE_KIND),
  bytes: z.number(),
  status: z.number(),
  /** The step of the ingestion that failed, or the API code a request was refused with. */
  stage: z.string(),
  reason: z.string(),
});

export type LogContext = z.infer<typeof LogContextSchema>;

/**
 * One JSON object per line on stdout. Log IDs, lengths, durations and counts only: never document
 * content, questions or answers.
 */
export function log(entry: Record<string, unknown> & Partial<LogContext>): void {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
}

/** The class name of a thrown value: safe to log, unlike its message, which may quote content. */
export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
