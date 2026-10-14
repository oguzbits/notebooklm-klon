import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { UsageStatusSchema } from '@nlm/shared';

import type { AuthVariables } from '../auth/session';
import { HTTP_STATUS } from '../http-status';
import type { UsageGuard } from '../usage/usage-guard';
import { json, unauthenticated } from './openapi';

const usageRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    [HTTP_STATUS.OK]: json(
      UsageStatusSchema,
      'What the user used of the limits of the day, and when each one frees up'
    ),
    401: unauthenticated,
  },
});

/** The limits of the day as the reader sees them. */
export function usageRoutes(guard: UsageGuard) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  return app.openapi(usageRoute, async (c) =>
    c.json(await guard.status(c.var.userId), HTTP_STATUS.OK)
  );
}
