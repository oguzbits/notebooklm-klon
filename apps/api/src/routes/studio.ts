import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CreateStudioBodySchema,
  StudioOutputListSchema,
  StudioOutputSchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { NoSourcesSelectedError } from '../chat/answer';
import { EmptyStudioOutputError } from '../core/studio-prompt';
import { getChatConfig } from '../db/chat-config-repository';
import { findNotebook } from '../db/notebook-repository';
import {
  createStudioOutput,
  deleteStudioOutput,
  listStudioOutputs,
  loadStudioChunks,
} from '../db/studio-repository';
import { generateStudioOutput } from '../studio/generate';
import { json, notFound, unauthenticated } from './openapi';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const CONFLICT = 409;
const UNPROCESSABLE = 422;
const NOT_FOUND = 404;

const notebookParams = z.object({ notebookId: z.string().min(1) });

const listRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/studio',
  request: { params: notebookParams },
  responses: {
    [OK]: json(StudioOutputListSchema, 'The outputs of the Studio, newest first'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const createStudioRoute = createRoute({
  method: 'post',
  path: '/{notebookId}/studio',
  request: {
    params: notebookParams,
    body: { content: { 'application/json': { schema: CreateStudioBodySchema } }, required: true },
  },
  responses: {
    [CREATED]: json(StudioOutputSchema, 'The output made from the selected sources'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
    [CONFLICT]: json(ApiErrorSchema, 'No source is selected and ready'),
    [UNPROCESSABLE]: json(ApiErrorSchema, 'The sources support no part of the output'),
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/studio/{outputId}',
  request: { params: notebookParams.extend({ outputId: z.string().min(1) }) },
  responses: {
    [NO_CONTENT]: { description: 'The output is deleted' },
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

/** The Studio: reports, flashcards, quizzes and mind maps made from the selected sources. */
export function studioRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const missing = { code: API_ERROR.NOT_FOUND };
  const ports = {
    chatConfig: (userId: string, notebookId: string) => getChatConfig(deps.db, userId, notebookId),
    loadChunks: (userId: string, notebookId: string, maxChars: number) =>
      loadStudioChunks(deps.db, userId, notebookId, maxChars),
    save: (userId: string, notebookId: string, output: Parameters<typeof createStudioOutput>[3]) =>
      createStudioOutput(deps.db, userId, notebookId, output),
    stream: deps.chat.stream,
  };

  return app
    .openapi(listRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId))) return c.json(missing, NOT_FOUND);
      return c.json(await listStudioOutputs(deps.db, userId, notebookId), OK);
    })
    .openapi(createStudioRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      try {
        const output = await generateStudioOutput(
          { userId: c.var.userId, notebookId, body: c.req.valid('json') },
          ports
        );
        return output ? c.json(output, CREATED) : c.json(missing, NOT_FOUND);
      } catch (error) {
        if (error instanceof NoSourcesSelectedError) {
          return c.json({ code: API_ERROR.NO_SOURCES_SELECTED }, CONFLICT);
        }
        if (error instanceof EmptyStudioOutputError) {
          return c.json({ code: API_ERROR.STUDIO_EMPTY }, UNPROCESSABLE);
        }
        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { notebookId, outputId } = c.req.valid('param');
      const deleted = await deleteStudioOutput(deps.db, c.var.userId, notebookId, outputId);
      return deleted ? c.body(null, NO_CONTENT) : c.json(missing, NOT_FOUND);
    });
}
