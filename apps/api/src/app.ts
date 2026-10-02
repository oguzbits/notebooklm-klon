import { OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, HealthSchema } from '@nlm/shared';
import { HTTPException } from 'hono/http-exception';

import type { AppDeps } from './app-deps';
import { type AuthVariables, requireUser } from './auth/session';
import { errorBody, mapError } from './error-mapping';
import { HTTP_STATUS } from './http-status';
import { log } from './logger';
import { chatRoutes } from './routes/chat';
import { chatConfigRoutes } from './routes/chat-config';
import { coverRoutes } from './routes/cover';
import { guestRoutes } from './routes/guest';
import { notebookOverviewRoutes } from './routes/notebook-overview';
import { notebookSourceRoutes } from './routes/notebook-sources';
import { notebookRoutes } from './routes/notebooks';
import { noteRoutes } from './routes/notes';
import { overviewRoutes } from './routes/overview';
import { readerRoutes } from './routes/reader';
import { sourceRoutes } from './routes/sources';
import { studioRoutes } from './routes/studio';
import { capabilityRoutes, webSearchRoutes } from './routes/web-search';

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>({
    // A request that fails validation is always the same shape of error, whatever the route.
    defaultHook: (result, c) => {
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.');
        return c.json(
          errorBody(API_ERROR.INVALID_REQUEST, field || undefined),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      return undefined;
    },
  });

  app.onError((error, c) => {
    const mapped = mapError(error);
    if (mapped) return c.json(mapped.body, mapped.status);
    if (error instanceof HTTPException) return error.getResponse();
    // Log the kind of error and the route, never the message: it could carry document content.
    log({
      level: 'error',
      msg: 'unhandled error',
      name: error.name,
      path: new URL(c.req.url).pathname,
    });
    return c.json(errorBody(API_ERROR.INTERNAL), HTTP_STATUS.INTERNAL_SERVER_ERROR);
  });

  app.get('/health', (c) => c.json(HealthSchema.parse({ status: 'ok' })));
  // Guests are made by the guest route only: it copies the example and counts them.
  app.post('/api/auth/sign-in/anonymous', (c) => c.json(errorBody(API_ERROR.NOT_FOUND), 404));
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));
  app.route('/api/guest', guestRoutes(deps));

  app.use('/api/notebooks', requireUser(deps.auth));
  app.use('/api/notebooks/*', requireUser(deps.auth));
  app.use('/api/web-search', requireUser(deps.auth));
  app.use('/api/capabilities', requireUser(deps.auth));

  return app
    .route('/api/web-search', webSearchRoutes(deps))
    .route('/api/capabilities', capabilityRoutes(deps))
    .route('/api/notebooks', notebookRoutes(deps))
    .route('/api/notebooks', notebookSourceRoutes(deps))
    .route('/api/notebooks', coverRoutes(deps))
    .route('/api/notebooks', sourceRoutes(deps))
    .route('/api/notebooks', chatRoutes(deps))
    .route('/api/notebooks', readerRoutes(deps))
    .route('/api/notebooks', overviewRoutes(deps))
    .route('/api/notebooks', notebookOverviewRoutes(deps))
    .route('/api/notebooks', noteRoutes(deps))
    .route('/api/notebooks', chatConfigRoutes(deps))
    .route('/api/notebooks', studioRoutes(deps));
}

export type AppType = ReturnType<typeof createApp>;
