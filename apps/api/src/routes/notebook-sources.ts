import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  RenameSourceBodySchema,
  SetSourceSelectionBodySchema,
  SourceListSchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { findNotebook } from '../db/notebook-repository';
import {
  listNotebookSources,
  renameSource,
  setSourceSelected,
  unlinkSource,
} from '../db/notebook-source-repository';
import { invalid, json, notebookParams, notFound, sourceParams, unauthenticated } from './openapi';

const OK = 200;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

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

/** The sources of a notebook: list them, choose which answers may use, rename one, take one out. */
export function notebookSourceRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  return app
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
