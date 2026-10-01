import type { ChatConfig, CreateStudioBody, NewStudioOutput, StudioOutput } from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import { NoSourcesSelectedError } from '../chat/answer';
import { LIMITS } from '../config/limits';
import { readStudioReply, studioPrompt, studioRequest } from '../core/studio-prompt';

/** What the Studio needs from the outside. Fakes in tests, database and Gemini in production. */
export interface StudioPorts {
  /** The notebook's config, or null when the notebook is not the user's. */
  chatConfig: (userId: string, notebookId: string) => Promise<ChatConfig | null>;
  /** The selected, ready sources it may work on, or only the picked ones among them. */
  listSources: (
    userId: string,
    notebookId: string,
    sourceIds?: readonly string[]
  ) => Promise<{ id: string; title: string }[]>;
  loadChunks: (
    userId: string,
    notebookId: string,
    maxChars: number,
    sourceIds: readonly string[]
  ) => Promise<{ id: string; text: string }[]>;
  save: (
    userId: string,
    notebookId: string,
    output: NewStudioOutput
  ) => Promise<StudioOutput | null>;
  stream: (input: ChatInput) => AsyncIterable<string>;
}

/**
 * Makes one output from the selected sources (or the ones picked among them) and saves it, with how
 * it was asked for. Null when the notebook is not the user's; throws NoSourcesSelectedError before
 * any model call when there is nothing to work on, and EmptyStudioOutputError when the sources
 * support no part of the output.
 */
export async function generateStudioOutput(
  input: { userId: string; notebookId: string; body: CreateStudioBody },
  ports: StudioPorts
): Promise<StudioOutput | null> {
  const config = await ports.chatConfig(input.userId, input.notebookId);
  if (!config) return null;

  const sources = await ports.listSources(input.userId, input.notebookId, input.body.sourceIds);
  const chunks =
    sources.length === 0
      ? []
      : await ports.loadChunks(
          input.userId,
          input.notebookId,
          LIMITS.STUDIO_MAX_CHARS,
          sources.map((source) => source.id)
        );
  if (chunks.length === 0) throw new NoSourcesSelectedError();

  const request = studioRequest(input.body, chunks, config.language);
  let reply = '';
  for await (const piece of ports.stream({
    system: request.system,
    user: request.user,
    schema: request.schema,
  })) {
    reply += piece;
  }

  const { output } = readStudioReply(input.body, reply, request.context);
  return ports.save(input.userId, input.notebookId, {
    ...output,
    request: { prompt: studioPrompt(input.body), sources },
  });
}
