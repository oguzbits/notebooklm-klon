import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { API_ERROR, ApiErrorSchema, GuestStartSchema } from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { AppDeps } from '../app-deps';
import { DEMO_NOTEBOOK_TITLE } from '../config/demo';
import { LIMITS } from '../config/limits';
import { user } from '../db/auth-schema';
import { copyNotebookToUser, countGuests, findDemoTemplate } from '../db/guest-repository';
import { createIpLimit } from '../guest/ip-limit';
import { startGuest } from '../guest/start-guest';
import { HTTP_STATUS } from '../http-status';
import { json } from './openapi';

const HOUR_MS = 60 * 60 * 1000;
const FORWARDED_FOR = 'x-forwarded-for';

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
  const allowAddress = createIpLimit(LIMITS.GUESTS_PER_IP_PER_HOUR, HOUR_MS);

  return app.openapi(guestRoute, async (c) => {
    // Only Caddy reaches the app, and it replaces this header with the address it saw. Without the
    // header (local development, tests) there is no address to count.
    const address = c.req.header(FORWARDED_FOR)?.split(',').at(-1)?.trim();
    if (address && !allowAddress(address, new Date()))
      return c.json({ code: API_ERROR.GUEST_UNAVAILABLE }, HTTP_STATUS.SERVICE_UNAVAILABLE);

    const started = ownerEmail
      ? await startGuest({
          findTemplate: () => findDemoTemplate(deps.systemDb, ownerEmail, DEMO_NOTEBOOK_TITLE),
          countGuests: (since) => countGuests(deps.systemDb, since),
          signIn: async () => {
            const response = await deps.auth.api.signInAnonymous({
              headers: c.req.raw.headers,
              asResponse: true,
            });
            if (!response.ok) throw new Error('The guest could not be signed in.');
            const { user: guest } = SignedInSchema.parse(await response.clone().json());
            return { userId: guest.id, response };
          },
          copy: (template, userId) => copyNotebookToUser(deps.systemDb, template, userId),
          remove: async (userId) => {
            await deps.systemDb.delete(user).where(eq(user.id, userId));
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
