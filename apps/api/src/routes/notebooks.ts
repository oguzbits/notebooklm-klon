import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CreateNotebookBodySchema,
  NotebookListSchema,
  NotebookSchema,
  UpdateNotebookBodySchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { LIMITS } from '../config/limits';
import {
  createNotebook,
  deleteNotebook,
  duplicateNotebook,
  findNotebook,
  listNotebooks,
  updateNotebook,
} from '../db/notebook-repository';
import { HTTP_STATUS } from '../http-status';
import { coverKey } from '../storage/cover-key';
import { removeObjectQuietly } from '../storage/remove-quietly';
import { forUser } from './for-user';
import { invalid, json, notebookParams, notFound, unauthenticated } from './openapi';

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    [HTTP_STATUS.OK]: json(NotebookListSchema, 'The own notebooks'),
    401: unauthenticated,
  },
});

const createRoute_ = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: CreateNotebookBodySchema } }, required: true },
  },
  responses: {
    [HTTP_STATUS.CREATED]: json(NotebookSchema, 'The new notebook'),
    400: invalid,
    401: unauthenticated,
    [HTTP_STATUS.CONFLICT]: json(ApiErrorSchema, 'The user has as many notebooks as allowed'),
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
    [HTTP_STATUS.OK]: json(NotebookSchema, 'The changed notebook'),
    400: invalid,
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const copyRoute = createRoute({
  method: 'post',
  path: '/{notebookId}/copy',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.CREATED]: json(
      NotebookSchema,
      'The copy: same sources, summaries and settings, no chat'
    ),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
    [HTTP_STATUS.CONFLICT]: json(ApiErrorSchema, 'The user has as many notebooks as allowed'),
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.NO_CONTENT]: { description: 'The notebook and its chat history are deleted' },
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/** Notebooks and the sources inside them. Everything is scoped to the signed-in user. */
export function notebookRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  return app
    .openapi(listRoute, async (c) =>
      c.json(
        await forUser(deps, c.var.userId, (db) => listNotebooks(db, c.var.userId)),
        HTTP_STATUS.OK
      )
    )
    .openapi(createRoute_, async (c) => {
      const { title } = c.req.valid('json');
      return c.json(
        await forUser(deps, c.var.userId, (db) =>
          createNotebook(db, c.var.userId, title, LIMITS.NOTEBOOKS_PER_USER)
        ),
        HTTP_STATUS.CREATED
      );
    })
    .openapi(updateRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const changes = c.req.valid('json');
      const updated = await forUser(deps, c.var.userId, (db) =>
        updateNotebook(db, c.var.userId, notebookId, changes)
      );
      return updated
        ? c.json(updated, HTTP_STATUS.OK)
        : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(copyRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const copy = await forUser(deps, c.var.userId, (db) =>
        duplicateNotebook(db, c.var.userId, notebookId, LIMITS.NOTEBOOKS_PER_USER)
      );
      return copy
        ? c.json(copy, HTTP_STATUS.CREATED)
        : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(deleteRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      const existing = await forUser(deps, userId, (db) => findNotebook(db, userId, notebookId));
      const deleted = await forUser(deps, userId, (db) => deleteNotebook(db, userId, notebookId));
      if (!deleted) return c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
      // The cover image goes with the notebook.
      if (existing?.coverVersion && deps.objectStore) {
        const key = coverKey(userId, notebookId, existing.coverVersion);
        await removeObjectQuietly(deps.objectStore, key);
      }
      return c.body(null, HTTP_STATUS.NO_CONTENT);
    });
}
