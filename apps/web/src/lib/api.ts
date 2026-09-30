import type { AppType } from '@nlm/api/app';
import { API_ERROR, type ApiErrorCode, ApiErrorSchema } from '@nlm/shared';
import { hc } from 'hono/client';
import type { z } from 'zod';

/** The typed client for the API. The base is empty: the browser talks to its own origin. */
export const api = hc<AppType>('');

/** An error the API answered with. `code` is one of the shared codes, the UI maps it to German. */
export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

/** Turns a failed response into an ApiRequestError. A body without a known code counts as INTERNAL. */
export async function toRequestError(response: Response): Promise<ApiRequestError> {
  const body = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  return new ApiRequestError(body.success ? body.data.code : API_ERROR.INTERNAL, response.status);
}

/** Reads a JSON response and checks it against the shared schema, or throws the API's error. */
export async function readJson<T extends z.ZodType>(
  response: Response,
  schema: T
): Promise<z.infer<T>> {
  if (!response.ok) throw await toRequestError(response);
  return schema.parse(await response.json());
}

/** For responses without a body (204). */
export async function expectOk(response: Response): Promise<void> {
  if (!response.ok) throw await toRequestError(response);
}
