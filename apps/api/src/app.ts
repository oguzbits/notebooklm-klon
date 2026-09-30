import { OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, type ApiError, HealthSchema } from '@nlm/shared';
import { HTTPException } from 'hono/http-exception';

import { GeminiError } from './ai/gemini-error';
import type { AppDeps } from './app-deps';
import { type AuthVariables, requireUser } from './auth/session';
import { ImportError } from './import/fetch-url';
import { QuotaExceededError } from './ingestion/ingest';
import { log } from './logger';
import { chatRoutes } from './routes/chat';
import { notebookRoutes } from './routes/notebooks';
import { readerRoutes } from './routes/reader';
import { sourceRoutes } from './routes/sources';

const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const INTERNAL_ERROR = 500;

const errorBody = (code: ApiError['code'], detail?: string): ApiError =>
  detail === undefined ? { code } : { code, detail };

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>({
    // A request that fails validation is always the same shape of error, whatever the route.
    defaultHook: (result, c) => {
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.');
        return c.json(errorBody(API_ERROR.INVALID_REQUEST, field || undefined), BAD_REQUEST);
      }
      return undefined;
    },
  });

  app.onError((error, c) => {
    if (error instanceof QuotaExceededError) {
      return c.json(errorBody(API_ERROR.UPLOAD_LIMIT_REACHED), TOO_MANY_REQUESTS);
    }
    if (error instanceof ImportError) {
      return c.json(errorBody(API_ERROR.INVALID_URL, error.code), BAD_REQUEST);
    }
    if (error instanceof GeminiError && error.status === TOO_MANY_REQUESTS) {
      return c.json(errorBody(API_ERROR.CHAT_LIMIT_REACHED), TOO_MANY_REQUESTS);
    }
    if (error instanceof HTTPException) return error.getResponse();
    // Log the kind of error and the route, never the message: it could carry document content.
    log({
      level: 'error',
      msg: 'unhandled error',
      name: error.name,
      path: new URL(c.req.url).pathname,
    });
    return c.json(errorBody(API_ERROR.INTERNAL), INTERNAL_ERROR);
  });

  app.get('/health', (c) => c.json(HealthSchema.parse({ status: 'ok' })));
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));

  app.use('/api/notebooks', requireUser(deps.auth));
  app.use('/api/notebooks/*', requireUser(deps.auth));

  return app
    .route('/api/notebooks', notebookRoutes(deps))
    .route('/api/notebooks', sourceRoutes(deps))
    .route('/api/notebooks', chatRoutes(deps))
    .route('/api/notebooks', readerRoutes(deps));
}

export type AppType = ReturnType<typeof createApp>;
