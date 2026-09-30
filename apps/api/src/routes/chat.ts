import { API_ERROR, ChatRequestSchema } from '@nlm/shared';
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
import { findNotebook, selectedReadySourceIds } from '../db/notebook-repository';
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
      prepared = await prepareAnswer({ userId, notebookId, question: parsed.data.question }, ports);
    } catch (caught) {
      if (caught instanceof NoSourcesSelectedError) {
        return c.json(error(API_ERROR.NO_SOURCES_SELECTED), CONFLICT);
      }
      throw caught;
    }

    return streamSSE(c, async (stream) => {
      for await (const event of answerQuestion(prepared, ports)) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      }
    });
  });
}
