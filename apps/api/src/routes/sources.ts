import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  SOURCE_KIND,
  type SourceKind,
  SubmitSourceResultSchema,
  UrlSourceBodySchema,
} from '@nlm/shared';
import { bodyLimit } from 'hono/body-limit';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { LIMITS } from '../config/limits';
import { detectSourceKind } from '../core/file-kind';
import { findNotebook, linkSource } from '../db/notebook-repository';
import { fetchPublicUrl } from '../import/fetch-url';
import { submitSource } from '../ingestion/submit';
import { pageTitle } from '../parsing/parse-web';
import { countPdfPages } from '../parsing/pdf-pages';

const ACCEPTED = 202;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const TOO_LARGE = 413;
const UNSUPPORTED = 415;
const UNPROCESSABLE = 422;
// Room for the multipart framing around a file that is exactly at the limit.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

const error = (code: (typeof API_ERROR)[keyof typeof API_ERROR]) => ({ code });
const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});

const urlRoute = createRoute({
  method: 'post',
  path: '/{notebookId}/sources/url',
  request: {
    params: z.object({ notebookId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: UrlSourceBodySchema } }, required: true },
  },
  responses: {
    [ACCEPTED]: json(SubmitSourceResultSchema, 'The page is being processed'),
    [BAD_REQUEST]: json(ApiErrorSchema, 'The URL is not allowed or could not be read'),
    401: json(ApiErrorSchema, 'Not signed in'),
    [NOT_FOUND]: json(ApiErrorSchema, 'Notebook not found'),
    429: json(ApiErrorSchema, 'The quota for new sources is used up'),
  },
});

/** Adds the content to the user's sources (once) and to the notebook, then queues it. */
async function addToNotebook(
  deps: AppDeps,
  input: {
    userId: string;
    notebookId: string;
    kind: SourceKind;
    title: string;
    sourceUrl: string | null;
    bytes: Uint8Array;
  }
) {
  const result = await submitSource(
    {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      sourceUrl: input.sourceUrl,
      bytes: input.bytes,
    },
    deps.ingest
  );
  if (!(await linkSource(deps.db, input.userId, input.notebookId, result.sourceId))) {
    throw new Error('The source could not be linked to the notebook.');
  }
  return result;
}

/** Adding sources: a file upload and a URL import. Both end in the same ingestion job. */
export function sourceRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  // Multipart upload, not described in OpenAPI: the schema language has no good file type.
  app.post(
    '/:notebookId/sources/file',
    bodyLimit({
      maxSize: LIMITS.UPLOAD_MAX_BYTES + MULTIPART_OVERHEAD_BYTES,
      onError: (c) => c.json(error(API_ERROR.FILE_TOO_LARGE), TOO_LARGE),
    }),
    async (c) => {
      const { userId } = c.var;
      const notebookId = c.req.param('notebookId');
      if (!(await findNotebook(deps.db, userId, notebookId))) {
        return c.json(error(API_ERROR.NOT_FOUND), NOT_FOUND);
      }

      const form = await c.req.parseBody();
      const file = form.file;
      if (!(file instanceof File)) return c.json(error(API_ERROR.INVALID_REQUEST), BAD_REQUEST);
      if (file.size > LIMITS.UPLOAD_MAX_BYTES) {
        return c.json(error(API_ERROR.FILE_TOO_LARGE), TOO_LARGE);
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = detectSourceKind(file.name, bytes);
      if (kind === null) return c.json(error(API_ERROR.UNSUPPORTED_FILE), UNSUPPORTED);

      if (kind === SOURCE_KIND.PDF) {
        let pages: number;
        try {
          pages = await countPdfPages(bytes);
        } catch (caught) {
          // A damaged or encrypted PDF cannot be read by pdf-lib. That is the user's file, not ours.
          if (caught instanceof Error)
            return c.json(error(API_ERROR.UNSUPPORTED_FILE), UNSUPPORTED);
          throw caught;
        }
        if (pages > LIMITS.UPLOAD_MAX_PDF_PAGES) {
          return c.json(error(API_ERROR.TOO_MANY_PAGES), UNPROCESSABLE);
        }
      }

      const result = await addToNotebook(deps, {
        userId,
        notebookId,
        kind,
        title: file.name,
        sourceUrl: null,
        bytes,
      });
      return c.json(result, ACCEPTED);
    }
  );

  return app.openapi(urlRoute, async (c) => {
    const { userId } = c.var;
    const { notebookId } = c.req.valid('param');
    const { url } = c.req.valid('json');
    if (!(await findNotebook(deps.db, userId, notebookId))) {
      return c.json(error(API_ERROR.NOT_FOUND), NOT_FOUND);
    }

    // An ImportError from here is turned into a 400 by the app-wide error handler.
    const page = await fetchPublicUrl(url, deps.fetch);
    const title = pageTitle(page.body) ?? new URL(page.finalUrl).hostname;
    const result = await addToNotebook(deps, {
      userId,
      notebookId,
      kind: SOURCE_KIND.URL,
      title,
      sourceUrl: page.finalUrl,
      bytes: page.body,
    });
    return c.json(result, ACCEPTED);
  });
}
