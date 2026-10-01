import { randomUUID } from 'node:crypto';

import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, ApiErrorSchema, COVER_IMAGE, NotebookSchema } from '@nlm/shared';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { detectImageType } from '../core/image-type';
import { findNotebook, setCoverVersion } from '../db/notebook-repository';
import { coverKey } from '../storage/cover-key';
import { removeObjectQuietly } from '../storage/remove-quietly';
import { json, notebookParams, notFound, unauthenticated } from './openapi';

const OK = 200;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;
const ONE_YEAR_SECONDS = 31_536_000;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

const unavailable = json(ApiErrorSchema, 'Cover images are not set up');

const putRoute = createRoute({
  method: 'put',
  path: '/{notebookId}/cover',
  request: { params: notebookParams },
  responses: {
    [OK]: json(NotebookSchema, 'The notebook with its new cover image'),
    [BAD_REQUEST]: json(ApiErrorSchema, 'No image, not a PNG, JPEG or WebP, or too large'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
    [UNAVAILABLE]: unavailable,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/cover',
  request: { params: notebookParams },
  responses: {
    [NO_CONTENT]: { description: 'The notebook has no cover image any more' },
    401: unauthenticated,
    [NOT_FOUND]: notFound,
    [UNAVAILABLE]: unavailable,
  },
});

/**
 * The image in the form of an upload, with the type its first bytes show; null for anything that is
 * no cover: no file, an empty or too large one, or one that is not a PNG, JPEG or WebP.
 */
async function readCoverImage(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > COVER_IMAGE.MAX_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);
  return contentType ? { bytes, contentType } : null;
}

/** Hands out the image of a notebook's cover with the type it was stored with and nothing else. */
const serveCover =
  (deps: AppDeps) => async (c: Context<{ Variables: AuthVariables }, '/:notebookId/cover'>) => {
    const { objectStore } = deps;
    if (!objectStore) return c.json({ code: API_ERROR.COVER_UNAVAILABLE }, UNAVAILABLE);
    const { userId } = c.var;
    const notebookId = c.req.param('notebookId');
    const notebook = await findNotebook(deps.db, userId, notebookId);
    if (!notebook?.coverVersion) return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);

    const stored = await objectStore.get(coverKey(userId, notebookId, notebook.coverVersion));
    if (!stored) return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
    return c.body(stored.bytes.slice(), OK, {
      'content-type': stored.contentType,
      // The address carries the version, so a cached copy is never stale. Not shared between users.
      'cache-control': `private, max-age=${ONE_YEAR_SECONDS}, immutable`,
      'x-content-type-options': 'nosniff',
    });
  };

/**
 * The cover image of a notebook. The file goes to the object store under a key with a new version
 * each time, so a browser that cached the old one asks for the new one. Only PNG, JPEG and WebP
 * are accepted, found by their first bytes; the file is handed out with that type and nothing else.
 */
export function coverRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  // Before the route parses the form, so a body far over the limit is never read into memory.
  app.use(
    '/:notebookId/cover',
    bodyLimit({
      maxSize: COVER_IMAGE.MAX_BYTES + MULTIPART_OVERHEAD_BYTES,
      onError: (c) => c.json({ code: API_ERROR.COVER_INVALID }, BAD_REQUEST),
    })
  );

  return (
    app
      .openapi(putRoute, async (c) => {
        const { objectStore } = deps;
        if (!objectStore) return c.json({ code: API_ERROR.COVER_UNAVAILABLE }, UNAVAILABLE);
        const { userId } = c.var;
        const { notebookId } = c.req.valid('param');
        if (!(await findNotebook(deps.db, userId, notebookId))) {
          return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
        }

        const image = await readCoverImage(c.req.raw);
        if (!image) return c.json({ code: API_ERROR.COVER_INVALID }, BAD_REQUEST);

        const { bytes, contentType } = image;
        const version = randomUUID();
        await objectStore.put(coverKey(userId, notebookId, version), { bytes, contentType });
        const changed = await setCoverVersion(deps.db, userId, notebookId, version);
        if (!changed) {
          await removeObjectQuietly(objectStore, coverKey(userId, notebookId, version));
          return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
        }
        if (changed.previous)
          await removeObjectQuietly(objectStore, coverKey(userId, notebookId, changed.previous));
        return c.json(changed.notebook, OK);
      })
      .openapi(deleteRoute, async (c) => {
        const { objectStore } = deps;
        if (!objectStore) return c.json({ code: API_ERROR.COVER_UNAVAILABLE }, UNAVAILABLE);
        const { userId } = c.var;
        const { notebookId } = c.req.valid('param');
        const changed = await setCoverVersion(deps.db, userId, notebookId, null);
        if (!changed) return c.json({ code: API_ERROR.NOT_FOUND }, NOT_FOUND);
        if (changed.previous)
          await removeObjectQuietly(objectStore, coverKey(userId, notebookId, changed.previous));
        return c.body(null, NO_CONTENT);
      })
      // Not described for OpenAPI: it answers with the bytes of an image, not with JSON.
      .get('/:notebookId/cover', serveCover(deps))
  );
}
