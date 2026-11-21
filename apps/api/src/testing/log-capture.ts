import { type MockInstance, vi } from 'vitest';
import { z } from 'zod';

const LogLineSchema = z.record(z.string(), z.unknown());
export type LogLine = z.infer<typeof LogLineSchema>;

/** Collects what `log` writes to stdout, so a test can look at the lines. Call `restore` after. */
export function captureLog() {
  const written: string[] = [];
  const spy: MockInstance = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  return {
    /** Every line that is a JSON object, in order. */
    lines: (): LogLine[] =>
      written
        .join('')
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .map((line) => LogLineSchema.parse(JSON.parse(line))),
    /** Everything written, as one text: to prove that something does not appear. */
    text: () => written.join(''),
    restore: () => spy.mockRestore(),
  };
}
