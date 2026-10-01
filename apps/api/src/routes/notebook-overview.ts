import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, NotebookOverviewResponseSchema } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { getOrCreateNotebookOverview } from '../chat/notebook-overview';
import { createNotebookOverviewPorts } from '../chat/notebook-overview-ports';
import { json, notebookParams, notFound, unauthenticated } from './openapi';

const OK = 200;
const NOT_FOUND = 404;

const overviewRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/overview',
  request: { params: notebookParams },
  responses: {
    [OK]: json(
      NotebookOverviewResponseSchema,
      'What all ready sources of the notebook are about, or null while none is ready'
    ),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
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
    return result ? c.json(result, OK) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
  });
}
