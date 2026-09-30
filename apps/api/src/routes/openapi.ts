import type { z } from '@hono/zod-openapi';
import { ApiErrorSchema } from '@nlm/shared';

/** A JSON response entry of an OpenAPI route. */
export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});

export const notFound = json(ApiErrorSchema, 'Not found, or not owned by the user');
export const unauthenticated = json(ApiErrorSchema, 'Not signed in');
