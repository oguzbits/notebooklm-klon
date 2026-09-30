import { type AnswerStatement, API_ERROR, CHAT_EVENT, ChatRequestSchema } from '@nlm/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import {
  answerQuestion,
  type ChatPorts,
  NoSourcesSelectedError,
  prepareAnswer,
} from '../chat/answer';
import { getChatConfig } from '../db/chat-config-repository';
import { findNotebook, selectedReadySourceIds } from '../db/notebook-repository';
import { saveAssistantMessage, saveUserMessage } from '../db/reader-repository';
import { searchChunks } from '../db/retrieval';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;

const error = (code: (typeof API_ERROR)[keyof typeof API_ERROR]) => ({ code });

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

    let prepared;
    try {
      prepared = await prepareAnswer(
        {
          userId,
          notebookId,
          question: parsed.data.question,
          config: (await getChatConfig(deps.db, userId, notebookId)) ?? undefined,
        },
        ports
      );
    } catch (caught) {
      if (caught instanceof NoSourcesSelectedError) {
        return c.json(error(API_ERROR.NO_SOURCES_SELECTED), CONFLICT);
      }
      throw caught;
    }

    // Saved only now: a rejected question (no source ready, quota) leaves no trace in the history.
    await saveUserMessage(deps.db, userId, notebookId, parsed.data.question);

    return streamSSE(c, async (stream) => {
      const statements: AnswerStatement[] = [];
      let saved = false;
      // An answer is saved once, before its last event goes out, so the client can read it back at
      // once. An answer with no statements is saved only if the model finished (it found nothing).
      const saveAnswer = async (finished: boolean) => {
        if (saved || (!finished && statements.length === 0)) return;
        saved = true;
        await saveAssistantMessage(deps.db, userId, notebookId, statements);
      };

      try {
        for await (const event of answerQuestion(prepared, ports)) {
          if (event.type === CHAT_EVENT.STATEMENT) {
            statements.push({ text: event.text, chunkIds: event.chunkIds });
          } else {
            await saveAnswer(event.type === CHAT_EVENT.DONE);
          }
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        }
      } finally {
        // The client left midway: keep what it already saw.
        await saveAnswer(false);
      }
    });
  });
}
