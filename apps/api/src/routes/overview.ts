import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, SourceOverviewSchema } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { getOrCreateOverview } from '../chat/overview';
import { createOverviewPorts } from '../chat/overview-ports';
import { HTTP_STATUS } from '../http-status';
import { json, notFound, sourceParams, unauthenticated } from './openapi';

const overviewRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/sources/{sourceId}/overview',
  request: { params: sourceParams },
  responses: {
    [HTTP_STATUS.OK]: json(
      SourceOverviewSchema,
      'Summary, key topics and suggested questions of a source'
    ),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/** The overview of a source: made by the model on first request, then read from the database. */
export function overviewRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const ports = createOverviewPorts(deps.db, deps.chat.stream);

  return app.openapi(overviewRoute, async (c) => {
    const { notebookId, sourceId } = c.req.valid('param');
    const overview = await getOrCreateOverview(
      { userId: c.var.userId, notebookId, sourceId },
      ports
    );
    return overview
      ? c.json(overview, HTTP_STATUS.OK)
      : c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
  });
}
