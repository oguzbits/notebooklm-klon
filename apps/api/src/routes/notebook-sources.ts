import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
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
  RESTART,
  restartFailedSource,
  setReadySourcesSelected,
  setSourceSelected,
  unlinkSource,
} from '../db/notebook-source-repository';
import { HTTP_STATUS } from '../http-status';
import { restartSource } from '../ingestion/submit';
import { invalid, json, notebookParams, notFound, sourceParams, unauthenticated } from './openapi';

const listSourcesRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/sources',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.OK]: json(SourceListSchema, 'The sources of the notebook'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const selectAllRoute = createRoute({
  method: 'patch',
  path: '/{notebookId}/sources',
  request: {
    params: notebookParams,
    body: {
      content: { 'application/json': { schema: SetSourceSelectionBodySchema } },
      required: true,
    },
  },
  responses: {
    [HTTP_STATUS.OK]: json(
      z.object({ selected: z.boolean() }),
      'The new selection of all ready sources'
    ),
    400: invalid,
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
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
    [HTTP_STATUS.OK]: json(z.object({ selected: z.boolean() }), 'The new selection'),
    400: invalid,
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
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
    [HTTP_STATUS.OK]: json(z.object({ title: z.string() }), 'The new title of the source'),
    400: invalid,
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const retryRoute = createRoute({
  method: 'post',
  path: '/{notebookId}/sources/{sourceId}/retry',
  request: { params: sourceParams },
  responses: {
    [HTTP_STATUS.ACCEPTED]: { description: 'The source is being read again' },
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
    [HTTP_STATUS.CONFLICT]: json(
      ApiErrorSchema,
      'The source did not fail, or its original file is no longer kept'
    ),
  },
});

const removeRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/sources/{sourceId}',
  request: { params: sourceParams },
  responses: {
    [HTTP_STATUS.NO_CONTENT]: { description: 'The source is no longer part of the notebook' },
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/** The sources of a notebook: list them, choose which answers may use, rename one, read a failed one again, take one out. */
export function notebookSourceRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  return app
    .openapi(listSourcesRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId))) {
        return c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
      }
      return c.json(await listNotebookSources(deps.db, userId, notebookId), HTTP_STATUS.OK);
    })
    .openapi(selectAllRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { selected } = c.req.valid('json');
      const changed = await setReadySourcesSelected(deps.db, c.var.userId, notebookId, selected);
      return changed
        ? c.json({ selected }, HTTP_STATUS.OK)
        : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
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
      return changed
        ? c.json({ selected }, HTTP_STATUS.OK)
        : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(renameSourceRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const { title } = c.req.valid('json');
      const renamed = await renameSource(deps.db, c.var.userId, notebookId, sourceId, title);
      return renamed
        ? c.json({ title }, HTTP_STATUS.OK)
        : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(retryRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const result = await restartFailedSource(deps.db, c.var.userId, notebookId, sourceId);
      if (result === RESTART.STARTED) {
        await restartSource(sourceId, deps.ingest);
        return c.body(null, HTTP_STATUS.ACCEPTED);
      }
      return result === RESTART.MISSING
        ? c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND)
        : c.json({ code: API_ERROR.SOURCE_NOT_RETRYABLE }, HTTP_STATUS.CONFLICT);
    })
    .openapi(removeRoute, async (c) => {
      const { notebookId, sourceId } = c.req.valid('param');
      const removed = await unlinkSource(deps.db, c.var.userId, notebookId, sourceId);
      return removed
        ? c.body(null, HTTP_STATUS.NO_CONTENT)
        : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
    });
}
