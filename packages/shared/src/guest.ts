import { z } from 'zod';

/** Guests of the live demo are deleted after this many days; the app tells them so. */
export const GUEST_LIMITS = { LIFETIME_DAYS: 7 } as const;

/** What starting as a guest answers with: the example notebook that was made for the guest. */
export const GuestStartSchema = z.object({ notebookId: z.uuid() });

export type GuestStart = z.infer<typeof GuestStartSchema>;

/** Most a user may keep: notebooks, and sources inside one notebook. The original limits rather than paging. */
export const USER_LIMITS = { NOTEBOOKS: 100, SOURCES_PER_NOTEBOOK: 50 } as const;
