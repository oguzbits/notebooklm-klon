import { OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, HealthSchema } from '@nlm/shared';
import { HTTPException } from 'hono/http-exception';
import { requestId, type RequestIdVariables } from 'hono/request-id';

import type { AppDeps } from './app-deps';
import { type AuthVariables, requireUser } from './auth/session';
import { LIMITS } from './config/limits';
import { countStalledSources } from './db/source-storage';
import { errorBody, mapError } from './error-mapping';
import { HTTP_STATUS } from './http-status';
import { log } from './logger';
import { ERROR_ORIGIN } from './observability/error-origin';
import { chatRoutes } from './routes/chat';
import { chatConfigRoutes } from './routes/chat-config';
import { coverRoutes } from './routes/cover';
import { forUser } from './routes/for-user';
import { guestRoutes } from './routes/guest';
import { notebookOverviewRoutes } from './routes/notebook-overview';
import { notebookSourceRoutes } from './routes/notebook-sources';
import { notebookRoutes } from './routes/notebooks';
import { noteRoutes } from './routes/notes';
import { overviewRoutes } from './routes/overview';
import { readerRoutes } from './routes/reader';
import { sourceRoutes } from './routes/sources';
import { studioRoutes } from './routes/studio';
import { usageRoutes } from './routes/usage';
import { capabilityRoutes, webSearchRoutes } from './routes/web-search';
import { createUsageGuard } from './usage/usage-guard';

/**
 * The container is only healthy while the database answers (the count asks it): a failure throws and
 * becomes a 500. A stalled queue shows in the body only, it must not restart the container.
 */
async function checkHealth(deps: AppDeps) {
  const stalledSources = await countStalledSources(
    deps.systemDb,
    new Date(Date.now() - LIMITS.STALLED_JOB_AFTER_MS)
  );
  return HealthSchema.parse({ status: 'ok', stalledSources });
}

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables & RequestIdVariables }>({
    // A request that fails validation is always the same shape of error, whatever the route.
    defaultHook: (result, c) => {
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.');
        return c.json(
          errorBody(API_ERROR.INVALID_REQUEST, field || undefined, c.get('requestId')),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      return undefined;
    },
  });

  // One ID per request: a proxy may send it, otherwise it is made here. It is in the response header,
  // in the body of an error and in every log line about the request.
  app.use(requestId());

  app.onError((error, c) => {
    const mapped = mapError(error);
    if (mapped) return c.json({ ...mapped.body, requestId: c.get('requestId') }, mapped.status);
    if (error instanceof HTTPException) return error.getResponse();
    // Log the kind of error and the route, never the message: it could carry document content.
    log({
      level: 'error',
      msg: 'unhandled error',
      name: error.name,
      path: new URL(c.req.url).pathname,
      requestId: c.get('requestId'),
    });
    deps.reportError(error, { origin: ERROR_ORIGIN.REQUEST, requestId: c.get('requestId') });
    return c.json(
      errorBody(API_ERROR.INTERNAL, undefined, c.get('requestId')),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  });

  app.get('/health', async (c) => c.json(await checkHealth(deps)));
  // Guests are made by the guest route only: it copies the example and counts them.
  app.post('/api/auth/sign-in/anonymous', (c) => c.json(errorBody(API_ERROR.NOT_FOUND), 404));
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));
  app.route('/api/guest', guestRoutes(deps));

  app.use('/api/notebooks', requireUser(deps.auth));
  app.use('/api/notebooks/*', requireUser(deps.auth));
  app.use('/api/web-search', requireUser(deps.auth));
  app.use('/api/capabilities', requireUser(deps.auth));
  app.use('/api/usage', requireUser(deps.auth));

  // One guard for the whole app: it knows which requests are running.
  const usage = createUsageGuard((userId, work) => forUser(deps, userId, work), deps.systemDb);

  return app
    .route('/api/web-search', webSearchRoutes(deps))
    .route('/api/capabilities', capabilityRoutes(deps))
    .route('/api/usage', usageRoutes(usage))
    .route('/api/notebooks', notebookRoutes(deps))
    .route('/api/notebooks', notebookSourceRoutes(deps, usage))
    .route('/api/notebooks', coverRoutes(deps))
    .route('/api/notebooks', sourceRoutes(deps, usage))
    .route('/api/notebooks', chatRoutes(deps, usage))
    .route('/api/notebooks', readerRoutes(deps))
    .route('/api/notebooks', overviewRoutes(deps, usage))
    .route('/api/notebooks', notebookOverviewRoutes(deps, usage))
    .route('/api/notebooks', noteRoutes(deps))
    .route('/api/notebooks', chatConfigRoutes(deps))
    .route('/api/notebooks', studioRoutes(deps, usage));
}

export type AppType = ReturnType<typeof createApp>;
