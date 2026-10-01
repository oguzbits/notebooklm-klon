import { describe, expect, it } from 'vitest';

import { LIMITS } from '../config/limits';
import { type GuestPorts, startGuest } from './start-guest';

const TEMPLATE = { userId: 'owner', notebookId: 'example' };
const SIGNED_IN = new Response('{"token":"t"}', { headers: { 'set-cookie': 'session=1' } });

interface Calls {
  copied: { toUserId: string }[];
  removed: string[];
  signedIn: number;
}

function ports(overrides: Partial<GuestPorts> = {}): { ports: GuestPorts; calls: Calls } {
  const calls: Calls = { copied: [], removed: [], signedIn: 0 };
  return {
    calls,
    ports: {
      findTemplate: async () => TEMPLATE,
      countGuests: async () => 0,
      signIn: async () => {
        calls.signedIn += 1;
        return { userId: 'guest-1', response: SIGNED_IN };
      },
      copy: async (_template, toUserId) => {
        calls.copied.push({ toUserId });
        return 'copy-1';
      },
      remove: async (userId) => {
        calls.removed.push(userId);
      },
      ...overrides,
    },
  };
}

describe('startGuest', () => {
  it('signs a guest in and gives them a copy of the example, which the answer names', async () => {
    const { ports: p, calls } = ports();

    const started = await startGuest(p);

    expect(started?.notebookId).toBe('copy-1');
    expect(started?.response).toBe(SIGNED_IN);
    expect(calls.copied).toEqual([{ toUserId: 'guest-1' }]);
  });

  it('starts nobody while there is no example to copy', async () => {
    const { ports: p, calls } = ports({ findTemplate: async () => null });

    expect(await startGuest(p)).toBeNull();
    expect(calls.signedIn).toBe(0);
  });

  it('starts nobody when too many guests were started within the hour', async () => {
    const { ports: p, calls } = ports({
      countGuests: async (since) => (since ? LIMITS.GUESTS_PER_HOUR : 0),
    });

    expect(await startGuest(p)).toBeNull();
    expect(calls.signedIn).toBe(0);
  });

  it('starts nobody when too many guests exist at the moment', async () => {
    const { ports: p, calls } = ports({
      countGuests: async (since) => (since ? 0 : LIMITS.GUESTS_ALIVE),
    });

    expect(await startGuest(p)).toBeNull();
    expect(calls.signedIn).toBe(0);
  });

  it('removes the guest again when the copy fails, and fails', async () => {
    const { ports: p, calls } = ports({
      copy: async () => {
        throw new Error('copy failed');
      },
    });

    await expect(startGuest(p)).rejects.toThrow('copy failed');
    expect(calls.removed).toEqual(['guest-1']);
  });
});
