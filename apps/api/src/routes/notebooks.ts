import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  API_ERROR,
  CreateNotebookBodySchema,
  NotebookListSchema,
  NotebookSchema,
  UpdateNotebookBodySchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import {
  createNotebook,
  deleteNotebook,
  duplicateNotebook,
  findNotebook,
  listNotebooks,
  updateNotebook,
} from '../db/notebook-repository';
import { coverKey } from '../storage/cover-key';
import { removeObjectQuietly } from '../storage/remove-quietly';
import { invalid, json, notebookParams, notFound, unauthenticated } from './openapi';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: { [OK]: json(NotebookListSchema, 'The own notebooks'), 401: unauthenticated },
});

const createRoute_ = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: CreateNotebookBodySchema } }, required: true },
  },
  responses: {
    [CREATED]: json(NotebookSchema, 'The new notebook'),
    400: invalid,
    401: unauthenticated,
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/{notebookId}',
  request: {
    params: notebookParams,
    body: { content: { 'application/json': { schema: UpdateNotebookBodySchema } }, required: true },
  },
  responses: {
    [OK]: json(NotebookSchema, 'The changed notebook'),
    400: invalid,
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const copyRoute = createRoute({
  method: 'post',
  path: '/{notebookId}/copy',
  request: { params: notebookParams },
  responses: {
    [CREATED]: json(NotebookSchema, 'The copy: same sources, summaries and settings, no chat'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}',
  request: { params: notebookParams },
  responses: {
    [NO_CONTENT]: { description: 'The notebook and its chat history are deleted' },
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

/** Notebooks and the sources inside them. Everything is scoped to the signed-in user. */
export function notebookRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  return app
    .openapi(listRoute, async (c) => c.json(await listNotebooks(deps.db, c.var.userId), OK))
    .openapi(createRoute_, async (c) => {
      const { title } = c.req.valid('json');
      return c.json(await createNotebook(deps.db, c.var.userId, title), CREATED);
    })
    .openapi(updateRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const changes = c.req.valid('json');
      const updated = await updateNotebook(deps.db, c.var.userId, notebookId, changes);
      return updated ? c.json(updated, OK) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    })
    .openapi(copyRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const copy = await duplicateNotebook(deps.db, c.var.userId, notebookId);
      return copy ? c.json(copy, CREATED) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    })
    .openapi(deleteRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      const existing = await findNotebook(deps.db, userId, notebookId);
      const deleted = await deleteNotebook(deps.db, userId, notebookId);
      if (!deleted) return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
      // The cover image goes with the notebook.
      if (existing?.coverVersion && deps.objectStore) {
        const key = coverKey(userId, notebookId, existing.coverVersion);
        await removeObjectQuietly(deps.objectStore, key);
      }
      return c.body(null, NO_CONTENT);
    });
}
