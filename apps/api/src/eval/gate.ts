import { z } from 'zod';

import type { EvalSummary } from './run';

/**
 * How far a rate may fall below the baseline before the run counts as worse. About one question of
 * the 28 that have an answer (3.6 %) passes, two fail. A guess from a single run: set it from the
 * spread of repeated runs once there are some.
 */
export const GATE_TOLERANCE = 0.05;

export const BaselineSchema = z.object({
  date: z.string(),
  questions: z.number().int(),
  retrievalHitRate: z.number(),
  factsInAnswer: z.number(),
  factsInCitedChunks: z.number(),
  abstentionRate: z.number(),
});
export type Baseline = z.infer<typeof BaselineSchema>;

const GATED = [
  'retrievalHitRate',
  'factsInAnswer',
  'factsInCitedChunks',
  'abstentionRate',
] as const;

/** The measures that fell more than the tolerance below the baseline, in words; empty means no worse. */
export function compareToBaseline(
  summary: EvalSummary,
  baseline: Baseline,
  tolerance = GATE_TOLERANCE
): string[] {
  return GATED.flatMap((measure) => {
    const value = summary[measure];
    // A measure that was not scored (no question for it) cannot be worse.
    if (value === null || value >= baseline[measure] - tolerance) return [];
    return [`${measure}: ${value.toFixed(2)} statt ${baseline[measure].toFixed(2)}`];
  });
}
