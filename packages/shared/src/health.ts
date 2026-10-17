import { z } from 'zod';

export const HealthSchema = z.object({
  status: z.literal('ok'),
  /** Sources whose ingestion job should have finished by now. Above 0 for long, the queue hangs. */
  stalledSources: z.number().int().nonnegative(),
});

export type Health = z.infer<typeof HealthSchema>;
