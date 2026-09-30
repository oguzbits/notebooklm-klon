import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CreateNoteBodySchema,
  NoteListSchema,
  NoteSchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import { createNoteFromMessage, deleteNote, listNotes } from '../db/note-repository';
import { findNotebook } from '../db/notebook-repository';
import { json, notFound, unauthenticated } from './openapi';

const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

const notebookParams = z.object({ notebookId: z.string().min(1) });

const listRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/notes',
  request: { params: notebookParams },
  responses: {
    [OK]: json(NoteListSchema, 'The notes, newest first'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const createNoteRoute = createRoute({
  method: 'post',
  path: '/{notebookId}/notes',
  request: {
    params: notebookParams,
    body: { content: { 'application/json': { schema: CreateNoteBodySchema } }, required: true },
  },
  responses: {
    [CREATED]: json(NoteSchema, 'The note made from the saved answer'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/notes/{noteId}',
  request: { params: notebookParams.extend({ noteId: z.string().min(1) }) },
  responses: {
    [NO_CONTENT]: { description: 'The note is deleted' },
    401: unauthenticated,
    [NOT_FOUND]: notFound,
  },
});

/** Notes: saved answers with their citations. The content is copied by the server, not sent. */
export function noteRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const missing = { code: API_ERROR.NOT_FOUND };

  return app
    .openapi(listRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId))) return c.json(missing, NOT_FOUND);
      return c.json(await listNotes(deps.db, userId, notebookId), OK);
    })
    .openapi(createNoteRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { messageId } = c.req.valid('json');
      const note = await createNoteFromMessage(deps.db, c.var.userId, notebookId, messageId);
      return note ? c.json(note, CREATED) : c.json(missing, NOT_FOUND);
    })
    .openapi(deleteRoute, async (c) => {
      const { notebookId, noteId } = c.req.valid('param');
      const deleted = await deleteNote(deps.db, c.var.userId, notebookId, noteId);
      return deleted ? c.body(null, NO_CONTENT) : c.json(missing, NOT_FOUND);
    });
}
