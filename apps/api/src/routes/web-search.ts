import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CapabilitiesSchema,
  WebSearchBodySchema,
  WebSearchResponseSchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { LIMITS } from '../config/limits';
import { createWindowLimit, HOUR_MS } from '../core/window-limit';
import { HTTP_STATUS } from '../http-status';
import { log } from '../logger';
import { json, unauthenticated } from './openapi';

const DAY_MS = 24 * HOUR_MS;

const searchRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: WebSearchBodySchema } }, required: true },
  },
  responses: {
    [HTTP_STATUS.OK]: json(WebSearchResponseSchema, 'Pages that could be added as sources'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [HTTP_STATUS.TOO_MANY_REQUESTS]: json(ApiErrorSchema, 'Too many searches'),
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: json(ApiErrorSchema, 'The web search is not set up'),
  },
});

const capabilitiesRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    [HTTP_STATUS.OK]: json(CapabilitiesSchema, 'What this installation can do'),
    401: unauthenticated,
  },
});

/**
 * The web search for new sources. The search service has a small monthly quota that everybody
 * shares, so each user gets a few searches an hour and everybody together a few a day. What comes
 * back is only a list of pages: adding one goes through the normal URL import with its checks.
 */
export function webSearchRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const perUser = createWindowLimit({
    max: LIMITS.WEB_SEARCHES_PER_USER_PER_HOUR,
    windowMs: HOUR_MS,
    now: Date.now,
  });
  const everybody = createWindowLimit({
    max: LIMITS.WEB_SEARCHES_PER_DAY,
    windowMs: DAY_MS,
    now: Date.now,
  });

  return app.openapi(searchRoute, async (c) => {
    const { webSearch } = deps;
    if (!webSearch)
      return c.json({ code: API_ERROR.WEB_SEARCH_UNAVAILABLE }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    const limited = { code: API_ERROR.WEB_SEARCH_LIMIT_REACHED };
    if (!perUser.take(c.var.userId) || !everybody.take('all')) {
      return c.json(limited, HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    const { query } = c.req.valid('json');
    const started = Date.now();
    const results = await webSearch.search(
      query,
      AbortSignal.timeout(LIMITS.WEB_SEARCH_TIMEOUT_MS)
    );
    // Only lengths and counts: the query is the reader's text.
    log({
      level: 'info',
      msg: 'web search',
      queryChars: query.length,
      results: results.length,
      durationMs: Date.now() - started,
    });
    return c.json({ results }, HTTP_STATUS.OK);
  });
}

/** Tells the UI which optional features this installation has. */
export function capabilityRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  return app.openapi(capabilitiesRoute, (c) =>
    c.json(
      { webSearch: deps.webSearch !== null, coverImage: deps.objectStore !== null },
      HTTP_STATUS.OK
    )
  );
}
