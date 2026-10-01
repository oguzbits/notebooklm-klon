import type { NotebookOverview } from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import {
  buildNotebookOverviewMessage,
  NOTEBOOK_OVERVIEW_JSON_SCHEMA,
  NOTEBOOK_OVERVIEW_SYSTEM_PROMPT,
  notebookOverviewKey,
  parseNotebookOverview,
} from '../core/notebook-overview-prompt';
import type {
  NotebookOverviewSource,
  StoredNotebookOverview,
} from '../db/notebook-overview-repository';

/** What the notebook overview needs from the outside. Fakes in tests, database and Gemini in production. */
export interface NotebookOverviewPorts {
  /** The ready sources and the stored overview, or null when the notebook is not the user's. */
  find: (
    userId: string,
    notebookId: string
  ) => Promise<{ sources: NotebookOverviewSource[]; stored: StoredNotebookOverview | null } | null>;
  save: (
    userId: string,
    notebookId: string,
    overview: NotebookOverview,
    key: string
  ) => Promise<void>;
  stream: (input: ChatInput) => AsyncIterable<string>;
}

/**
 * The overview of a notebook: what all its ready sources are about. It is made by the model when
 * the set of sources differs from the one it was made from, and stored, so a notebook costs one
 * model call per change of its sources and none for opening it. The symbol stays what it was: a
 * notebook keeps its face while its summary follows the sources.
 *
 * Null when the notebook is not the user's; `{ overview: null }` while no source is ready.
 */
export async function getOrCreateNotebookOverview(
  input: { userId: string; notebookId: string },
  ports: NotebookOverviewPorts
): Promise<{ overview: NotebookOverview | null } | null> {
  const found = await ports.find(input.userId, input.notebookId);
  if (!found) return null;
  if (found.sources.length === 0) return { overview: null };

  const key = notebookOverviewKey(found.sources.map((source) => source.id));
  if (found.stored?.key === key) return { overview: found.stored.overview };

  let reply = '';
  for await (const piece of ports.stream({
    system: NOTEBOOK_OVERVIEW_SYSTEM_PROMPT,
    user: buildNotebookOverviewMessage(found.sources),
    schema: NOTEBOOK_OVERVIEW_JSON_SCHEMA,
  })) {
    reply += piece;
  }
  const made = parseNotebookOverview(reply);
  const overview = found.stored ? { ...made, emoji: found.stored.overview.emoji } : made;
  await ports.save(input.userId, input.notebookId, overview, key);
  return { overview };
}
