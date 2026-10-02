import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, NotebookOverviewResponseSchema } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { getOrCreateNotebookOverview } from '../chat/notebook-overview';
import { createNotebookOverviewPorts } from '../chat/notebook-overview-ports';
import { HTTP_STATUS } from '../http-status';
import { json, notebookParams, notFound, unauthenticated } from './openapi';

const overviewRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/overview',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.OK]: json(
      NotebookOverviewResponseSchema,
      'What all ready sources of the notebook are about, or null while none is ready'
    ),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/**
 * The overview of a notebook: made by the model when the set of ready sources changed since it was
 * last made, otherwise read from the database.
 */
export function notebookOverviewRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const ports = createNotebookOverviewPorts(deps.db, deps.chat.stream);

  return app.openapi(overviewRoute, async (c) => {
    const { notebookId } = c.req.valid('param');
    const result = await getOrCreateNotebookOverview({ userId: c.var.userId, notebookId }, ports);
    return result
      ? c.json(result, HTTP_STATUS.OK)
      : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
  });
}
