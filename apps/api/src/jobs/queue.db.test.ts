import { afterEach, describe, expect, it } from 'vitest';

import { parseTestDatabaseEnv } from '../config/env';
import { createJobQueue, type JobQueue } from './queue';

const { TEST_DATABASE_URL } = parseTestDatabaseEnv(process.env);
const WAIT_MS = 15_000;

let queue: JobQueue | undefined;

afterEach(async () => {
  await queue?.stop();
  queue = undefined;
});

async function waitFor(condition: () => boolean, timeoutMs = WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the job');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('job queue', () => {
  it('hands an enqueued source to the worker with its ID', async () => {
    queue = await createJobQueue(TEST_DATABASE_URL, { onError: () => undefined });
    const received: unknown[] = [];
    await queue.work(async (payload) => {
      received.push(payload);
    });

    await queue.enqueue('source-1');

    await waitFor(() => received.length > 0);
    expect(received).toEqual([{ sourceId: 'source-1' }]);
  });

  it('does not run a failed job again on its own', async () => {
    queue = await createJobQueue(TEST_DATABASE_URL, { onError: () => undefined });
    let attempts = 0;
    await queue.work(async () => {
      attempts += 1;
      throw new Error('kaputt');
    });

    await queue.enqueue('source-2');

    await waitFor(() => attempts > 0);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(attempts).toBe(1);
  });
});
