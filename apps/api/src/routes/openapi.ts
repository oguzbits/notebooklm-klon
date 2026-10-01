import { z } from '@hono/zod-openapi';
import { ApiErrorSchema } from '@nlm/shared';

/** A JSON response entry of an OpenAPI route. */
export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});

export const notFound = json(ApiErrorSchema, 'Not found, or not owned by the user');
export const unauthenticated = json(ApiErrorSchema, 'Not signed in');

/** The address parameters every route inside a notebook has, and the one of a source inside it. */
export const notebookParams = z.object({ notebookId: z.string().min(1) });
export const sourceParams = notebookParams.extend({ sourceId: z.string().min(1) });

export const invalid = json(ApiErrorSchema, 'The request is invalid');
