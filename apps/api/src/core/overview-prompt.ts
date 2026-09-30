import { type SourceOverview, SourceOverviewSchema } from '@nlm/shared';
import { z } from 'zod';

/** About 15k tokens: enough for a summary of a long document, small next to the model's limits. */
export const OVERVIEW_MAX_TEXT_CHARS = 45_000;
const TRUNCATION_NOTE = '\n\n[Text gekürzt]';

export const OVERVIEW_SYSTEM_PROMPT =
  'You summarize one document for a reader who has not opened it yet. Use only what the document ' +
  'says. Always write in German, whatever language the document has. Return a summary of two to ' +
  'four sentences, up to eight key topics as short noun phrases, and up to four questions a ' +
  'reader could ask that the document answers. Do not invent facts, names or numbers.';

/** The answer contract as JSON Schema for the provider, derived from the shared schema. */
export const OVERVIEW_JSON_SCHEMA: Record<string, unknown> = (() => {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(SourceOverviewSchema);
  return schema;
})();

export function buildOverviewMessage(title: string, text: string): string {
  const body =
    text.length > OVERVIEW_MAX_TEXT_CHARS
      ? `${text.slice(0, OVERVIEW_MAX_TEXT_CHARS)}${TRUNCATION_NOTE}`
      : text;
  return `Document title: ${title}\n\n${body}`;
}

/** Reads the model's reply. Anything that is not a valid overview throws. */
export function parseOverview(raw: string): SourceOverview {
  return SourceOverviewSchema.parse(JSON.parse(raw));
}
