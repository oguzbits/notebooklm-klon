import {
  EMBEDDING_DIMENSIONS,
  SOURCE_FAILURE,
  SOURCE_KIND,
  SOURCE_STATUS,
  type SourceKind,
  SUBMIT_ACTION,
} from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { restartSource, runIngestJob, type SubmitPorts, submitSource } from './submit';

const USER = 'user-a';
const BYTES = new TextEncoder().encode('Inhalt');
const input = {
  userId: USER,
  kind: SOURCE_KIND.TXT,
  title: 'Notiz',
  sourceUrl: null,
  bytes: BYTES,
};

function fakePorts(overrides: Partial<SubmitPorts> = {}) {
  const log = {
    uploads: new Map<string, { kind: SourceKind; bytes: Uint8Array }>(),
    enqueued: [] as string[],
    failed: [] as string[],
    processed: [] as string[],
  };
  const rows: { id: string; status: string; hash: string; userId: string }[] = [];
  const ports: SubmitPorts = {
    sources: {
      findOrCreate: async (data) => {
        const existing = rows.find((r) => r.userId === data.userId && r.hash === data.contentHash);
        if (existing) return { id: existing.id, status: existing.status, created: false };
        const row = {
          id: `s${rows.length + 1}`,
          status: SOURCE_STATUS.PENDING,
          hash: data.contentHash,
          userId: data.userId,
        };
        rows.push(row);
        return { id: row.id, status: row.status, created: true };
      },
      markProcessing: async () => undefined,
      markReady: async () => undefined,
      markFailed: async (id, failure) => {
        log.failed.push(`${id}:${failure}`);
        const row = rows.find((r) => r.id === id);
        if (row) row.status = SOURCE_STATUS.FAILED;
      },
    },
    parse: async () => ({ text: 'Text', pageCount: null }),
    embed: async (texts) => texts.map(() => new Array<number>(EMBEDDING_DIMENSIONS).fill(0.1)),
    uploads: {
      put: async (id, bytes) => {
        log.uploads.set(id, { kind: SOURCE_KIND.TXT, bytes });
      },
      load: async (id) => log.uploads.get(id) ?? null,
      remove: async (id) => {
        log.uploads.delete(id);
      },
    },
    queue: {
      enqueue: async (id) => {
        log.enqueued.push(id);
      },
    },
    ...overrides,
  };
  return { ports, log, rows };
}

describe('submitSource', () => {
  it('stores the upload and enqueues one job for new content', async () => {
    const { ports, log } = fakePorts();

    const result = await submitSource(input, ports);

    expect(result).toEqual({ sourceId: 's1', action: SUBMIT_ACTION.CREATED });
    expect(log.uploads.get('s1')).toEqual({ kind: SOURCE_KIND.TXT, bytes: BYTES });
    expect(log.enqueued).toEqual(['s1']);
  });

  it('does nothing for content the user already has', async () => {
    const { ports, log } = fakePorts();
    await submitSource(input, ports);
    log.uploads.clear();
    log.enqueued.length = 0;

    const again = await submitSource(input, ports);

    expect(again.action).toBe(SUBMIT_ACTION.REUSED);
    expect(log.uploads.size).toBe(0);
    expect(log.enqueued).toEqual([]);
  });

  it('processes a failed source again', async () => {
    const { ports, log, rows } = fakePorts();
    await submitSource(input, ports);
    const [row] = rows;
    if (row) row.status = SOURCE_STATUS.FAILED;
    log.enqueued.length = 0;

    const again = await submitSource(input, ports);

    expect(again.action).toBe(SUBMIT_ACTION.RETRY);
    expect(log.enqueued).toEqual(['s1']);
  });

  it('marks the source FAILED, drops the upload and rethrows when enqueuing fails', async () => {
    const { ports, log } = fakePorts({
      queue: {
        enqueue: async () => {
          throw new Error('queue down');
        },
      },
    });

    await expect(submitSource(input, ports)).rejects.toThrow('queue down');

    expect(log.failed).toEqual([`s1:${SOURCE_FAILURE.ENQUEUE_FAILED}`]);
    expect(log.uploads.size).toBe(0);
  });
});

describe('runIngestJob', () => {
  it('loads the upload, processes the source and removes the upload once it is ready', async () => {
    const { ports, log } = fakePorts();
    await submitSource(input, ports);

    await runIngestJob({ sourceId: 's1' }, ports);

    expect(log.uploads.size).toBe(0);
  });

  it('keeps the upload and rethrows when processing fails, so the source can be read again', async () => {
    const { ports, log } = fakePorts({
      parse: async () => {
        throw new Error('kaputt');
      },
    });
    await submitSource(input, ports);

    await expect(runIngestJob({ sourceId: 's1' }, ports)).rejects.toThrow();

    expect(log.uploads.get('s1')?.bytes).toEqual(BYTES);
  });

  it('fails when the upload is missing instead of pretending to succeed', async () => {
    const { ports } = fakePorts();

    await expect(runIngestJob({ sourceId: 'gone' }, ports)).rejects.toThrow(/upload/i);
  });

  it('rejects a payload without a source ID', async () => {
    const { ports } = fakePorts();

    await expect(runIngestJob({}, ports)).rejects.toThrow();
    await expect(runIngestJob(null, ports)).rejects.toThrow();
  });
});

describe('restartSource', () => {
  it('enqueues one job for the source and keeps its upload', async () => {
    const { ports, log } = fakePorts();
    await submitSource(input, ports);
    log.enqueued.length = 0;

    await restartSource('s1', ports);

    expect(log.enqueued).toEqual(['s1']);
    expect(log.uploads.has('s1')).toBe(true);
  });

  it('marks the source FAILED again, keeps the upload and rethrows when enqueuing fails', async () => {
    const { ports, log } = fakePorts({
      queue: {
        enqueue: async () => {
          throw new Error('queue down');
        },
      },
    });
    log.uploads.set('s1', { kind: SOURCE_KIND.TXT, bytes: BYTES });

    await expect(restartSource('s1', ports)).rejects.toThrow('queue down');

    expect(log.failed).toEqual([`s1:${SOURCE_FAILURE.ENQUEUE_FAILED}`]);
    expect(log.uploads.has('s1')).toBe(true);
  });
});
