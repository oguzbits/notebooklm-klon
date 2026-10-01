import { LIMITS } from '../config/limits';
import type { DemoTemplate } from '../db/guest-repository';

const HOUR_MS = 60 * 60 * 1000;

/** What starting a guest needs from the outside. Fakes in tests, the database and Better Auth in production. */
export interface GuestPorts {
  /** The example notebook to copy, or null while the seed did not run. */
  findTemplate: () => Promise<DemoTemplate | null>;
  /** How many guests exist, or were started since the given moment. */
  countGuests: (since?: Date) => Promise<number>;
  /** Makes the guest account and its session: the response carries the cookie. */
  signIn: () => Promise<{ userId: string; response: Response }>;
  /** Copies the example notebook to the guest, returns the ID of the copy. */
  copy: (template: DemoTemplate, toUserId: string) => Promise<string>;
  remove: (userId: string) => Promise<void>;
}

/**
 * A guest for the live demo: an account of its own with a copy of the example notebook, so a
 * reviewer can try everything at once and nobody sees the uploads of somebody else. Null when no
 * guest can be started now: no example to copy, or too many guests (within the hour, and alive),
 * which keeps the demo from filling the database.
 */
export async function startGuest(
  ports: GuestPorts,
  now: Date = new Date()
): Promise<{ notebookId: string; response: Response } | null> {
  const template = await ports.findTemplate();
  if (!template) return null;
  const recently = await ports.countGuests(new Date(now.getTime() - HOUR_MS));
  if (recently >= LIMITS.GUESTS_PER_HOUR) return null;
  if ((await ports.countGuests()) >= LIMITS.GUESTS_ALIVE) return null;

  const { userId, response } = await ports.signIn();
  try {
    return { notebookId: await ports.copy(template, userId), response };
  } catch (error) {
    // A guest without the example would only be an empty account that nobody asked for.
    await ports.remove(userId);
    throw error;
  }
}
