import path from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { API_ERROR } from '@nlm/shared';
import type { Env, Hono, Schema } from 'hono';

import { HTTP_STATUS } from '../http-status';

const API_PREFIX = '/api/';
const HAS_EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Serves the built web app from `dir` next to the API: files as they are, and index.html for every
 * other page route so a reload on /notebook/… works. An unknown API path or a missing file
 * stays a 404 (JSON for the API): the app is not the answer for those. Call after the API routes.
 */
export function serveWeb<E extends Env, S extends Schema, B extends string>(
  app: Hono<E, S, B>,
  dir: string
): void {
  // serveStatic resolves against the working directory.
  const root = path.relative(process.cwd(), path.resolve(dir));
  const indexHtml = path.join(root, 'index.html');

  app.use('*', serveStatic({ root }));
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET') return next();
    const { pathname } = new URL(c.req.url);
    if (pathname.startsWith(API_PREFIX))
      return c.json({ code: API_ERROR.NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
    if (HAS_EXTENSION.test(pathname)) return c.notFound();
    return serveStatic({ path: indexHtml })(c, next);
  });
}
