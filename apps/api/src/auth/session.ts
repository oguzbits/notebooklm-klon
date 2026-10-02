import { API_ERROR, type ApiError } from '@nlm/shared';
import { createMiddleware } from 'hono/factory';

import { HTTP_STATUS } from '../http-status';
import type { Auth } from './auth';

export interface AuthVariables {
  /** The signed-in user. Comes from the server-side session, never from the client. */
  userId: string;
}

/** Refuses the request unless it carries a valid session, and exposes the user's ID. */
export function requireUser(auth: Auth) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      const body: ApiError = { code: API_ERROR.UNAUTHENTICATED };
      return c.json(body, HTTP_STATUS.UNAUTHORIZED);
    }
    c.set('userId', session.user.id);
    return next();
  });
}
