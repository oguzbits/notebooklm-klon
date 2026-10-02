/**
 * One JSON object per line on stdout. Log IDs, lengths, durations and counts only: never document
 * content, questions or answers.
 */
export function log(entry: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
}

/** The class name of a thrown value: safe to log, unlike its message, which may quote content. */
export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
