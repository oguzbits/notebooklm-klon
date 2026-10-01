import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  API_ERROR,
  ApiErrorSchema,
  CreateNoteBodySchema,
  NOTE_KIND,
  NoteListSchema,
  NoteSchema,
  NoteUpdateBodySchema,
} from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import type { AuthVariables } from '../auth/session';
import {
  createNoteFromMessage,
  createWrittenNote,
  deleteNote,
  listNotes,
  updateNote,
} from '../db/note-repository';
import { findNotebook } from '../db/notebook-repository';
import { HTTP_STATUS } from '../http-status';
import { json, notebookParams, notFound, unauthenticated } from './openapi';

const listRoute = createRoute({
  method: 'get',
  path: '/{notebookId}/notes',
  request: { params: notebookParams },
  responses: {
    [HTTP_STATUS.OK]: json(NoteListSchema, 'The notes, newest first'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
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
    [HTTP_STATUS.CREATED]: json(
      NoteSchema,
      'The note made from a saved answer, or an empty one to write'
    ),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/{notebookId}/notes/{noteId}',
  request: {
    params: notebookParams.extend({ noteId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: NoteUpdateBodySchema } }, required: true },
  },
  responses: {
    [HTTP_STATUS.OK]: json(NoteSchema, 'The note after the change'),
    400: json(ApiErrorSchema, 'The request is invalid'),
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{notebookId}/notes/{noteId}',
  request: { params: notebookParams.extend({ noteId: z.string().min(1) }) },
  responses: {
    [HTTP_STATUS.NO_CONTENT]: { description: 'The note is deleted' },
    401: unauthenticated,
    [HTTP_STATUS.NOT_FOUND]: notFound,
  },
});

/**
 * Notes: saved answers with their citations (copied by the server, never sent) and notes the reader
 * writes. The text of a saved answer cannot be changed, only its title.
 */
export function noteRoutes(deps: AppDeps) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const missing = { code: API_ERROR.NOT_FOUND };

  return app
    .openapi(listRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const { userId } = c.var;
      if (!(await findNotebook(deps.db, userId, notebookId)))
        return c.json(missing, HTTP_STATUS.NOT_FOUND);
      return c.json(await listNotes(deps.db, userId, notebookId), HTTP_STATUS.OK);
    })
    .openapi(createNoteRoute, async (c) => {
      const { notebookId } = c.req.valid('param');
      const body = c.req.valid('json');
      const note =
        body.kind === NOTE_KIND.ANSWER
          ? await createNoteFromMessage(deps.db, c.var.userId, notebookId, body.messageId)
          : await createWrittenNote(deps.db, c.var.userId, notebookId, {
              title: body.title,
              body: body.body,
            });
      return note ? c.json(note, HTTP_STATUS.CREATED) : c.json(missing, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(updateRoute, async (c) => {
      const { notebookId, noteId } = c.req.valid('param');
      const note = await updateNote(deps.db, c.var.userId, notebookId, noteId, c.req.valid('json'));
      return note ? c.json(note, HTTP_STATUS.OK) : c.json(missing, HTTP_STATUS.NOT_FOUND);
    })
    .openapi(deleteRoute, async (c) => {
      const { notebookId, noteId } = c.req.valid('param');
      const deleted = await deleteNote(deps.db, c.var.userId, notebookId, noteId);
      return deleted
        ? c.body(null, HTTP_STATUS.NO_CONTENT)
        : c.json(missing, HTTP_STATUS.NOT_FOUND);
    });
}
