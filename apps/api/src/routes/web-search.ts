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
import { createWindowLimit } from '../core/window-limit';
import { log } from '../logger';
import { WebSearchError } from '../search/tavily-search';
import { json, unauthenticated } from './openapi';

const OK = 200;
const TOO_MANY_REQUESTS = 429;
const UNAVAILABLE = 503;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const searchRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: WebSearchBodySchema } }, required: true },
  },
  responses: {
    [OK]: json(WebSearchResponseSchema, 'Pages that could be added as sources'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [TOO_MANY_REQUESTS]: json(ApiErrorSchema, 'Too many searches'),
    [UNAVAILABLE]: json(ApiErrorSchema, 'The web search is not set up'),
  },
});

const capabilitiesRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    [OK]: json(CapabilitiesSchema, 'What this installation can do'),
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
    if (!webSearch) return c.json({ code: API_ERROR.WEB_SEARCH_UNAVAILABLE }, UNAVAILABLE);
    const limited = { code: API_ERROR.WEB_SEARCH_LIMIT_REACHED };
    if (!perUser.take(c.var.userId) || !everybody.take('all')) {
      return c.json(limited, TOO_MANY_REQUESTS);
    }

    const { query } = c.req.valid('json');
    const started = Date.now();
    try {
      const results = await webSearch.search(query);
      // Only lengths and counts: the query is the reader's text.
      log({
        level: 'info',
        msg: 'web search',
        queryChars: query.length,
        results: results.length,
        durationMs: Date.now() - started,
      });
      return c.json({ results }, OK);
    } catch (error) {
      if (error instanceof WebSearchError && error.quotaExhausted) {
        return c.json(limited, TOO_MANY_REQUESTS);
      }
      throw error;
    }
  });
}

/** Tells the UI which optional features this installation has. */
export function capabilityRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  return app.openapi(capabilitiesRoute, (c) =>
    c.json({ webSearch: deps.webSearch !== null, coverImage: deps.objectStore !== null }, OK)
  );
}
