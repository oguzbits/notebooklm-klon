import { API_ERROR, CHAT_EVENT, ChatRequestSchema } from '@nlm/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { answerQuestion, type ChatPorts, prepareAnswer } from '../chat/answer';
import { AnswerRecorder } from '../chat/answer-recorder';
import { LIMITS } from '../config/limits';
import { createWindowLimit, HOUR_MS } from '../core/window-limit';
import { getChatConfig } from '../db/chat-config-repository';
import { findNotebook } from '../db/notebook-repository';
import { selectedReadySourceIds } from '../db/notebook-source-repository';
import { saveAssistantMessage, saveUserMessage } from '../db/reader-repository';
import { searchChunks } from '../db/retrieval';
import { HTTP_STATUS } from '../http-status';

const error = (code: (typeof API_ERROR)[keyof typeof API_ERROR]) => ({ code });

/** Asking a question about the selected sources of a notebook, answered as a stream of events. */
export function chatRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();

  const perUser = createWindowLimit({
    max: LIMITS.CHAT_QUESTIONS_PER_USER_PER_HOUR,
    windowMs: HOUR_MS,
    now: Date.now,
  });

  const ports: ChatPorts = {
    ...deps.chat,
    selectedSourceIds: (userId, notebookId) => selectedReadySourceIds(deps.db, userId, notebookId),
    search: (request) => searchChunks(deps.db, request),
  };

  return app.post('/:notebookId/chat', async (c) => {
    const { userId } = c.var;
    const notebookId = c.req.param('notebookId');
    if (!(await findNotebook(deps.db, userId, notebookId))) {
      return c.json(error(API_ERROR.NOT_FOUND), HTTP_STATUS.NOT_FOUND);
    }

    const parsed = ChatRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json(error(API_ERROR.INVALID_REQUEST), HTTP_STATUS.BAD_REQUEST);

    // Throws NoSourcesSelectedError before the stream starts: the error handler answers 409.
    const config = await getChatConfig(deps.db, userId, notebookId);
    const prepared = await prepareAnswer(
      { userId, notebookId, question: parsed.data.question, config: config ?? undefined },
      ports
    );

    // Counted only now: a question that is rejected above never reaches the model.
    if (!perUser.take(userId)) {
      return c.json(error(API_ERROR.CHAT_LIMIT_REACHED), HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    // Saved only now: a rejected question (no source ready, quota) leaves no trace in the history.
    await saveUserMessage(deps.db, userId, notebookId, parsed.data.question);

    return streamSSE(c, async (stream) => {
      const recorder = new AnswerRecorder((statements, followUps, trace) =>
        saveAssistantMessage(deps.db, userId, notebookId, { statements, followUps, trace })
      );
      // The reader closes the tab: stop the model request, so it neither runs on nor costs quota.
      const reader = new AbortController();
      stream.onAbort(() => reader.abort());
      try {
        for await (const event of answerQuestion(prepared, ports, reader.signal)) {
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
