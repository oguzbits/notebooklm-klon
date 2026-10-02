import { describe, expect, it } from 'vitest';

import { createShutdown } from './shutdown';

describe('createShutdown', () => {
  it('stops taking requests before it waits for the running job', async () => {
    const order: string[] = [];
    const shutdown = createShutdown({
      closeServer: async () => void order.push('server'),
      stopQueue: async () => void order.push('queue'),
    });

    await shutdown();

    expect(order).toEqual(['server', 'queue']);
  });

  it('runs once when the signal arrives twice', async () => {
    let calls = 0;
    const shutdown = createShutdown({
      closeServer: async () => void (calls += 1),
      stopQueue: async () => {},
    });

    await Promise.all([shutdown(), shutdown()]);

    expect(calls).toBe(1);
  });

  it('still stops the queue when closing the server fails, and then reports the failure', async () => {
    let queueStopped = false;
    const shutdown = createShutdown({
      closeServer: async () => {
        throw new Error('close failed');
      },
      stopQueue: async () => void (queueStopped = true),
    });

    await expect(shutdown()).rejects.toThrow('close failed');
    expect(queueStopped).toBe(true);
  });
});
