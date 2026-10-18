import type { AppType } from '@nlm/api/app';
import { API_ERROR, type ApiErrorCode, ApiErrorSchema, LOCALE_HEADER } from '@nlm/shared';
import { hc } from 'hono/client';
import type { z } from 'zod';

import { locale } from './i18n';

/** The typed client for the API. The base is empty: the browser talks to its own origin. */
export const api = hc<AppType>('', { headers: { [LOCALE_HEADER]: locale } });

/** An error the API answered with. `code` is one of the shared codes, the UI maps it to text. */
export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** The ID of the failed request, to report it. Set when the API sent one. */
  readonly requestId: string | undefined;

  constructor(code: ApiErrorCode, status: number, requestId?: string) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

/** Turns a failed response into an ApiRequestError. A body without a known code counts as INTERNAL. */
export async function toRequestError(response: Response): Promise<ApiRequestError> {
  const body = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  return body.success
    ? new ApiRequestError(body.data.code, response.status, body.data.requestId)
    : new ApiRequestError(API_ERROR.INTERNAL, response.status);
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
