import { GeminiError } from '../ai/gemini-error';
import type { QuestionResult } from './run';

const QUOTA_STATUS = 429;

/** True for a provider error that says the quota is used up (per minute or per day). */
export function isQuotaError(error: unknown): boolean {
  return error instanceof GeminiError && error.status === QUOTA_STATUS;
}

export interface RunAllOptions {
  pauseMs: number;
  /** Wait before the one retry of a question that hit the quota: a per-minute limit passes. */
  quotaWaitMs: number;
  sleep: (ms: number) => Promise<void>;
}

export interface RunAllResult {
  results: QuestionResult[];
  /** Questions not asked because the quota was still used up after the wait (daily limit). */
  notAsked: string[];
}

/**
 * Asks the questions one after another. A question whose call hit the quota is asked once more after
 * `quotaWaitMs`; if it hits it again, the run stops and that question and all later ones are
 * `notAsked` instead of being scored as failures. `ask` returns whether the quota was hit.
 */
export async function runAll<Q extends { id: string }>(
  questions: Q[],
  ask: (question: Q) => Promise<{ result: QuestionResult; quotaHit: boolean }>,
  options: RunAllOptions
): Promise<RunAllResult> {
  const results: QuestionResult[] = [];
  for (const [index, question] of questions.entries()) {
    let answer = await ask(question);
    if (answer.quotaHit) {
      await options.sleep(options.quotaWaitMs);
      answer = await ask(question);
    }
    if (answer.quotaHit) {
      return { results, notAsked: questions.slice(index).map((q) => q.id) };
    }
    results.push(answer.result);
    await options.sleep(options.pauseMs);
  }
  return { results, notAsked: [] };
}
