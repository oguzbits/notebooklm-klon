import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, ApiErrorSchema, GuestStartSchema } from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { AppDeps } from '../app-deps';
import { DEMO_NOTEBOOK_TITLE } from '../config/demo';
import { user } from '../db/auth-schema';
import { copyNotebookToUser, countGuests, findDemoTemplate } from '../db/guest-repository';
import { startGuest } from '../guest/start-guest';
import { HTTP_STATUS } from '../http-status';
import { json } from './openapi';

const SignedInSchema = z.object({ user: z.object({ id: z.string() }) });

const guestRoute = createRoute({
  method: 'post',
  path: '/',
  responses: {
    [HTTP_STATUS.OK]: json(
      GuestStartSchema,
      'A guest is signed in, with a copy of the example notebook'
    ),
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: json(ApiErrorSchema, 'No guest can be started now'),
  },
});

/**
 * The guest of the live demo: one click makes an account and a copy of the example notebook. It is
 * the only way to make a guest (the plugin's own route is closed in app.ts), so every guest is
 * counted and gets the copy.
 */
export function guestRoutes(deps: AppDeps) {
  const app = new OpenAPIHono();
  const ownerEmail = deps.demoOwnerEmail;

  return app.openapi(guestRoute, async (c) => {
    const started = ownerEmail
      ? await startGuest({
          findTemplate: () => findDemoTemplate(deps.db, ownerEmail, DEMO_NOTEBOOK_TITLE),
          countGuests: (since) => countGuests(deps.db, since),
          signIn: async () => {
            const response = await deps.auth.api.signInAnonymous({
              headers: c.req.raw.headers,
              asResponse: true,
            });
            if (!response.ok) throw new Error('The guest could not be signed in.');
            const { user: guest } = SignedInSchema.parse(await response.clone().json());
            return { userId: guest.id, response };
          },
          copy: (template, userId) => copyNotebookToUser(deps.db, template, userId),
          remove: async (userId) => {
            await deps.db.delete(user).where(eq(user.id, userId));
          },
        })
      : null;
    if (!started)
      return c.json({ code: API_ERROR.GUEST_UNAVAILABLE }, HTTP_STATUS.SERVICE_UNAVAILABLE);

    const response = c.json({ notebookId: started.notebookId }, HTTP_STATUS.OK);
    // The session cookie that Better Auth made for the guest.
    for (const cookie of started.response.headers.getSetCookie()) {
      response.headers.append('set-cookie', cookie);
    }
    return response;
  });
}
