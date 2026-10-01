import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CreateNotebookBodySchema,
  NotebookListSchema,
  NotebookSchema,
  RenameSourceBodySchema,
  SetSourceSelectionBodySchema,
  SourceListSchema,
  UpdateNotebookBodySchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import {
  createNotebook,
  deleteNotebook,
  findNotebook,
  listNotebooks,
  listNotebookSources,
  renameSource,
  setSourceSelected,
  unlinkSource,
  updateNotebook,
} from '../db/notebook-repository';
import { json, notFound, unauthenticated } from './openapi';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

const invalid = json(ApiErrorSchema, 'The request is invalid');

const notebookParams = z.object({ notebookId: z.string().min(1) });
const sourceParams = notebookParams.extend({ sourceId: z.string().min(1) });

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

const listSourcesRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/sources',
  request: { params: notebookParams },
  responses: {
    [OK]: json(SourceListSchema, 'The sources of the notebook'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const selectRoute = createRoute({
  method: 'patch',
  path: '/{notebookId}/sources/{sourceId}',
  request: {
    params: sourceParams,
    body: {
      content: { 'application/json': { schema: SetSourceSelectionBodySchema } },
      required: true,
    },
  },
  responses: {
    [OK]: json(z.object({ selected: z.boolean() }), 'The new selection'),
    400: invalid,
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const renameSourceRoute = createRoute({
  method: 'patch',
  path: '/{notebookId}/sources/{sourceId}/title',
  request: {
    params: sourceParams,
    body: { content: { 'application/json': { schema: RenameSourceBodySchema } }, required: true },
  },
  responses: {
    [OK]: json(z.object({ title: z.string() }), 'The new title of the source'),
    400: invalid,
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const removeRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/sources/{sourceId}',
  request: { params: sourceParams },
  responses: {
    [NO_CONTENT]: { description: 'The source is no longer part of the notebook' },
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
    .openapi(deleteRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const deleted = await deleteNotebook(deps.db, c.var.userId, notebookId);
      return deleted ? c.body(null, NO_CONTENT) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    })
    .openapi(listSourcesRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId))) {
        return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
      }
      return c.json(await listNotebookSources(deps.db, userId, notebookId), OK);
    })
    .openapi(selectRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const { selected } = c.req.valid('json');
      const changed = await setSourceSelected(
        deps.db,
        c.var.userId,
        notebookId,
        sourceId,
        selected
      );
      return changed ? c.json({ selected }, OK) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    })
    .openapi(renameSourceRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const { title } = c.req.valid('json');
      const renamed = await renameSource(deps.db, c.var.userId, notebookId, sourceId, title);
      return renamed ? c.json({ title }, OK) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    })
    .openapi(removeRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const removed = await unlinkSource(deps.db, c.var.userId, notebookId, sourceId);
      return removed ? c.body(null, NO_CONTENT) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    });
}
