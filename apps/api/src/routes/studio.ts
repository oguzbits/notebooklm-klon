import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CreateStudioBodySchema,
  StudioOutputListSchema,
  StudioOutputSchema,
  StudioUpdateBodySchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { getChatConfig } from '../db/chat-config-repository';
import { findNotebook } from '../db/notebook-repository';
import {
  createStudioOutput,
  deleteStudioOutput,
  listStudioOutputs,
  listStudioSources,
  loadStudioChunks,
  updateStudioOutput,
} from '../db/studio-repository';
import { HTTP_STATUS } from '../http-status';
import { generateStudioOutput } from '../studio/generate';
import { json, notebookParams, notFound, unauthenticated } from './openapi';

const listRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/studio',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.OK]: json(StudioOutputListSchema, 'The outputs of the Studio, newest first'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
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
    [HTTP_STATUS.CREATED]: json(StudioOutputSchema, 'The output made from the selected sources'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
    [HTTP_STATUS.CONFLICT]: json(ApiErrorSchema, 'No source is selected and ready'),
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: json(
      ApiErrorSchema,
      'The sources support no part of the output'
    ),
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/{notebookId}/studio/{outputId}',
  request: {
    params: notebookParams.extend({ outputId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: StudioUpdateBodySchema } }, required: true },
  },
  responses: {
    [HTTP_STATUS.OK]: json(StudioOutputSchema, 'The output after the change'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/studio/{outputId}',
  request: { params: notebookParams.extend({ outputId: z.string().min(1) }) },
  responses: {
    [HTTP_STATUS.NO_CONTENT]: { description: 'The output is deleted' },
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/** The database and model calls the Studio logic runs on. */
function studioPorts(deps: AppDeps) {
  return {
    chatConfig: (userId: string, notebookId: string) => getChatConfig(deps.db, userId, notebookId),
    listSources: (userId: string, notebookId: string, sourceIds?: readonly string[]) =>
      listStudioSources(deps.db, userId, notebookId, sourceIds),
    loadChunks: (
      userId: string,
      notebookId: string,
      maxChars: number,
      sourceIds: readonly string[]
    ) => loadStudioChunks(deps.db, userId, notebookId, maxChars, sourceIds),
    save: (userId: string, notebookId: string, output: Parameters<typeof createStudioOutput>[3]) =>
      createStudioOutput(deps.db, userId, notebookId, output),
    stream: deps.chat.stream,
  };
}

/** The Studio: reports, flashcards, quizzes and mind maps made from the selected sources. */
export function studioRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const missing = { code: API_ERROR.NOT_FOUND };
  const ports = studioPorts(deps);

  return app
    .openapi(listRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId)))
        return c.json(missing, HTTP_STATUS.NOT_FOUND);
      return c.json(await listStudioOutputs(deps.db, userId, notebookId), HTTP_STATUS.OK);
    })
    .openapi(createStudioRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const output = await generateStudioOutput(
        { userId: c.var.userId, notebookId, body: c.req.valid('json') },
        ports
      );
      return output ? c.json(output, HTTP_STATUS.CREATED) : c.json(missing, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(updateRoute, async (c) => {
      const { notebookId, outputId } = c.req.valid('param');
      const output = await updateStudioOutput(
        deps.db,
        c.var.userId,
        notebookId,
        outputId,
        c.req.valid('json')
      );
      return output ? c.json(output, HTTP_STATUS.OK) : c.json(missing, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(deleteRoute, async (c) => {
      const { notebookId, outputId } = c.req.valid('param');
      const deleted = await deleteStudioOutput(deps.db, c.var.userId, notebookId, outputId);
      return deleted
        ? c.body(null, HTTP_STATUS.NO_CONTENT)
        : c.json(missing, HTTP_STATUS.NOT_FOUND);
    });
}
