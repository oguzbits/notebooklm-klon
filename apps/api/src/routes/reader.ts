import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { API_ERROR, ChatMessageListSchema, ChunkDetailSchema, SourceTextSchema } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { findNotebook } from '../db/notebook-repository';
import {
  clearChatMessages,
  findChunkDetail,
  findSourceText,
  listChatMessages,
} from '../db/reader-repository';
import { json, notFound, unauthenticated } from './openapi';

const OK = 200;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

const notebookParams = z.object({ notebookId: z.string().min(1) });

const chunkRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/chunks/{chunkId}',
  request: { params: notebookParams.extend({ chunkId: z.string().min(1) }) },
  responses: {
    [OK]: json(ChunkDetailSchema, 'A cited passage'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const sourceTextRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/sources/{sourceId}/text',
  request: { params: notebookParams.extend({ sourceId: z.string().min(1) }) },
  responses: {
    [OK]: json(SourceTextSchema, 'The extracted text of a source'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const messagesRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/messages',
  request: { params: notebookParams },
  responses: {
    [OK]: json(ChatMessageListSchema, 'The chat history, oldest first'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const clearMessagesRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/messages',
  request: { params: notebookParams },
  responses: {
    [NO_CONTENT]: { description: 'The chat history of the notebook is deleted' },
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

/** What the reader and the chat history need: cited passages, source text and past messages. */
export function readerRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const missing = { code: API_ERROR.NOT_FOUND };

  return app
    .openapi(chunkRoute, async (c) => {
      const { notebookId, chunkId } = c.req.valid('param');
      const chunk = await findChunkDetail(deps.db, c.var.userId, notebookId, chunkId);
      return chunk ? c.json(chunk, OK) : c.json(missing, NOT_FOUND);
    })
    .openapi(sourceTextRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const source = await findSourceText(deps.db, c.var.userId, notebookId, sourceId);
      return source ? c.json(source, OK) : c.json(missing, NOT_FOUND);
    })
    .openapi(messagesRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId))) return c.json(missing, NOT_FOUND);
      return c.json(await listChatMessages(deps.db, userId, notebookId), OK);
    })
    .openapi(clearMessagesRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const cleared = await clearChatMessages(deps.db, c.var.userId, notebookId);
      return cleared ? c.body(null, NO_CONTENT) : c.json(missing, NOT_FOUND);
    });
}
