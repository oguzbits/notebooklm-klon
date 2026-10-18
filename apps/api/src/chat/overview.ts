import { type Locale, type SourceOverview, USAGE_PURPOSE } from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import {
  buildOverviewMessage,
  OVERVIEW_JSON_SCHEMA,
  overviewSystemPrompt,
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
 * costs one model call in its lifetime. It stays in the language of the first request. Null when the user cannot read the source.
 */
export async function getOrCreateOverview(
  input: { userId: string; notebookId: string; sourceId: string; locale: Locale },
  ports: OverviewPorts
): Promise<SourceOverview | null> {
  const source = await ports.find(input.userId, input.notebookId, input.sourceId);
  if (!source) return null;
  if (source.overview) return source.overview;

  let reply = '';
  for await (const piece of ports.stream({
    system: overviewSystemPrompt(input.locale),
    user: buildOverviewMessage(source.title, source.text),
    schema: OVERVIEW_JSON_SCHEMA,
    usage: { userId: input.userId, purpose: USAGE_PURPOSE.OVERVIEW },
  })) {
    reply += piece;
  }
  const overview = parseOverview(reply);
  await ports.save(input.userId, input.sourceId, overview);
  return overview;
}
