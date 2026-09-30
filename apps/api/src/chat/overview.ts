import type { SourceOverview } from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import {
  buildOverviewMessage,
  OVERVIEW_JSON_SCHEMA,
  OVERVIEW_SYSTEM_PROMPT,
  parseOverview,
} from '../core/overview-prompt';

/** What the overview needs from the outside. Fakes in tests, database and Gemini in production. */
export interface OverviewPorts {
  /** The source as the user may read it, or null when it is not theirs or has no text yet. */
  find: (
    userId: string,
    notebookId: string,
    sourceId: string
  ) => Promise<{ title: string; text: string; overview: SourceOverview | null } | null>;
  save: (userId: string, sourceId: string, overview: SourceOverview) => Promise<void>;
  stream: (input: ChatInput) => AsyncIterable<string>;
}

/**
 * The overview of a source. It is made by the model on first request and stored, so each source
 * costs one model call in its lifetime. Null when the user cannot read the source.
 */
export async function getOrCreateOverview(
  input: { userId: string; notebookId: string; sourceId: string },
  ports: OverviewPorts
): Promise<SourceOverview | null> {
  const source = await ports.find(input.userId, input.notebookId, input.sourceId);
  if (!source) return null;
  if (source.overview) return source.overview;

  let reply = '';
  for await (const piece of ports.stream({
    system: OVERVIEW_SYSTEM_PROMPT,
    user: buildOverviewMessage(source.title, source.text),
    schema: OVERVIEW_JSON_SCHEMA,
  })) {
    reply += piece;
  }
  const overview = parseOverview(reply);
  await ports.save(input.userId, input.sourceId, overview);
  return overview;
}
