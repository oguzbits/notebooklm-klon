import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, SourceOverviewSchema } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { getOrCreateOverview } from '../chat/overview';
import { createOverviewPorts } from '../chat/overview-ports';
import { json, notFound, sourceParams, unauthenticated } from './openapi';

const OK = 200;
const NOT_FOUND = 404;

const overviewRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/sources/{sourceId}/overview',
  request: { params: sourceParams },
  responses: {
    [OK]: json(SourceOverviewSchema, 'Summary, key topics and suggested questions of a source'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
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
    return overview ? c.json(overview, OK) : c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
  });
}
