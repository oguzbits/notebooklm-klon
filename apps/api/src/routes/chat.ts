import { API_ERROR, CHAT_EVENT, ChatRequestSchema } from '@nlm/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import {
  answerQuestion,
  type ChatPorts,
  NoSourcesSelectedError,
  prepareAnswer,
  type PreparedAnswer,
} from '../chat/answer';
import { AnswerRecorder } from '../chat/answer-recorder';
import { getChatConfig } from '../db/chat-config-repository';
import { findNotebook, selectedReadySourceIds } from '../db/notebook-repository';
import { saveAssistantMessage, saveUserMessage } from '../db/reader-repository';
import { searchChunks } from '../db/retrieval';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

const error = (code: (typeof API_ERROR)[keyof typeof API_ERROR]) => ({ code });

/** The answer prepared for a question, or null when no source is selected to answer from. */
async function tryPrepare(
  deps: AppDeps,
  ports: ChatPorts,
  input: { userId: string; notebookId: string; question: string }
): Promise<PreparedAnswer | null> {
  try {
    const config = await getChatConfig(deps.db, input.userId, input.notebookId);
    return await prepareAnswer({ ...input, config: config ?? undefined }, ports);
  } catch (caught) {
    if (caught instanceof NoSourcesSelectedError) return null;
    throw caught;
  }
}

/** Asking a question about the selected sources of a notebook, answered as a stream of events. */
export function chatRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();

  const ports: ChatPorts = {
    ...deps.chat,
    selectedSourceIds: (userId, notebookId) => selectedReadySourceIds(deps.db, userId, notebookId),
    search: (request) => searchChunks(deps.db, request),
  };

  return app.post('/:notebookId/chat', async (c) => {
    const { userId } = c.var;
    const notebookId = c.req.param('notebookId');
    if (!(await findNotebook(deps.db, userId, notebookId))) {
      return c.json(error(API_ERROR.NOT_FOUND), NOT_FOUND);
    }

    const parsed = ChatRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(error(API_ERROR.INVALID_REQUEST), BAD_REQUEST);

    const prepared = await tryPrepare(deps, ports, {
      userId,
      notebookId,
      question: parsed.data.question,
    });
    if (!prepared) return c.json(error(API_ERROR.NO_SOURCES_SELECTED), CONFLICT);

    // Saved only now: a rejected question (no source ready, quota) leaves no trace in the history.
    await saveUserMessage(deps.db, userId, notebookId, parsed.data.question);

    return streamSSE(c, async (stream) => {
      const recorder = new AnswerRecorder((statements, followUps, trace) =>
        saveAssistantMessage(deps.db, userId, notebookId, { statements, followUps, trace })
      );
      try {
        for await (const event of answerQuestion(prepared, ports)) {
          recorder.note(event);
          if (event.type !== CHAT_EVENT.STATEMENT) {
            await recorder.saveOnce(event.type === CHAT_EVENT.DONE);
          }
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        }
      } finally {
        // The client left midway: keep what it already saw.
        await recorder.saveOnce(false);
      }
    });
  });
}
