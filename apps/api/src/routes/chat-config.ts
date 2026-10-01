import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, ApiErrorSchema, ChatConfigSchema } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { getChatConfig, setChatConfig } from '../db/chat-config-repository';
import { HTTP_STATUS } from '../http-status';
import { json, notebookParams, notFound, unauthenticated } from './openapi';

const readRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/chat-config',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.OK]: json(ChatConfigSchema, 'How the assistant talks in this notebook'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const writeRoute = createRoute({
  method: 'put',
  path: '/{notebookId}/chat-config',
  request: {
    params: notebookParams,
    body: { content: { 'application/json': { schema: ChatConfigSchema } }, required: true },
  },
  responses: {
    [HTTP_STATUS.OK]: json(ChatConfigSchema, 'The saved config'),
    400: json(ApiErrorSchema, 'The config is invalid'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/** The chat settings of a notebook: style, answer length and language. */
export function chatConfigRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const missing = { code: API_ERROR.NOT_FOUND };

  return app
    .openapi(readRoute, async (c) => {
      const config = await getChatConfig(deps.db, c.var.userId, c.req.valid('param').notebookId);
      return config ? c.json(config, HTTP_STATUS.OK) : c.json(missing, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(writeRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const saved = await setChatConfig(deps.db, c.var.userId, notebookId, c.req.valid('json'));
      return saved ? c.json(saved, HTTP_STATUS.OK) : c.json(missing, HTTP_STATUS.NOT_FOUND);
    });
}
