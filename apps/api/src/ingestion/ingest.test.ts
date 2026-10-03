import {
  EMBEDDING_DIMENSIONS,
  SOURCE_FAILURE,
  SOURCE_KIND,
  SOURCE_STATUS,
  SUBMIT_ACTION,
} from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { LIMITS } from '../config/limits';
import { hashContent } from '../core/content-hash';
import {
  INGEST_ERROR,
  IngestError,
  type IngestPorts,
  processSource,
  registerSource,
} from './ingest';

const USER = 'user-a';
const BYTES = new TextEncoder().encode('Inhalt der Quelle');
const vector = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed);

type Row = { id: string; userId: string; hash: string; status: string };

/** In-memory ports that record what the pipeline does. */
function fakePorts(overrides: Partial<IngestPorts> = {}) {
  const rows: Row[] = [];
  const calls = {
    parse: 0,
    embed: [] as string[][],
    ready: [] as unknown[],
    failed: [] as string[],
  };
  const ports: IngestPorts = {
    sources: {
      findOrCreate: async (data) => {
        const existing = rows.find((r) => r.userId === data.userId && r.hash === data.contentHash);
        if (existing) return { id: existing.id, status: existing.status, created: false };
        const row = {
          id: `s${rows.length + 1}`,
          userId: data.userId,
          hash: data.contentHash,
          status: SOURCE_STATUS.PENDING,
        };
        rows.push(row);
        return { id: row.id, status: row.status, created: true };
      },
      markProcessing: async (id) => {
        const row = rows.find((r) => r.id === id);
        if (row) row.status = SOURCE_STATUS.PROCESSING;
      },
      markReady: async (id, result) => {
        const row = rows.find((r) => r.id === id);
        if (row) row.status = SOURCE_STATUS.READY;
        calls.ready.push(result);
      },
      markFailed: async (id, failure) => {
        const row = rows.find((r) => r.id === id);
        if (row) row.status = SOURCE_STATUS.FAILED;
        calls.failed.push(failure);
      },
    },
    parse: async () => {
      calls.parse += 1;
      return { text: 'Erster Satz.\n\nZweiter Satz.', pageCount: 2 };
    },
    embed: async (texts) => {
      calls.embed.push(texts);
      return texts.map((_, i) => vector(i + 1));
    },
    ...overrides,
  };
  return { ports, rows, calls };
}

const input = {
  userId: USER,
  kind: SOURCE_KIND.TXT,
  title: 'Notiz',
  sourceUrl: null,
  bytes: BYTES,
};

describe('registerSource', () => {
  it('creates a PENDING source identified by the content hash', async () => {
    const { ports, rows } = fakePorts();

    const result = await registerSource(input, ports);

    expect(result).toEqual({ sourceId: 's1', action: SUBMIT_ACTION.CREATED });
    expect(rows[0]).toMatchObject({
      userId: USER,
      hash: hashContent(BYTES),
      status: SOURCE_STATUS.PENDING,
    });
  });

  it('reuses a source with the same content for the same user and creates nothing', async () => {
    const { ports, rows } = fakePorts();
    await registerSource(input, ports);

    const again = await registerSource({ ...input, title: 'Anderer Titel' }, ports);

    expect(again).toEqual({ sourceId: 's1', action: SUBMIT_ACTION.REUSED });
    expect(rows).toHaveLength(1);
  });

  it('does not share a source between users', async () => {
    const { ports, rows } = fakePorts();
    await registerSource(input, ports);

    const other = await registerSource({ ...input, userId: 'user-b' }, ports);

    expect(other.action).toBe(SUBMIT_ACTION.CREATED);
    expect(rows).toHaveLength(2);
  });

  it('asks for a retry when the earlier attempt failed', async () => {
    const { ports, rows } = fakePorts();
    await registerSource(input, ports);
    const [row] = rows;
    if (row) row.status = SOURCE_STATUS.FAILED;

    const again = await registerSource(input, ports);

    expect(again).toEqual({ sourceId: 's1', action: SUBMIT_ACTION.RETRY });
    expect(rows).toHaveLength(1);
  });
});

describe('processSource', () => {
  it('parses, chunks, embeds and stores the source as READY', async () => {
    const { ports, calls, rows } = fakePorts();
    await registerSource(input, ports);

    await processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports);

    expect(rows[0]?.status).toBe(SOURCE_STATUS.READY);
    expect(calls.ready).toHaveLength(1);
    expect(calls.ready[0]).toMatchObject({
      canonicalText: 'Erster Satz.\n\nZweiter Satz.',
      pageCount: 2,
      chunks: [
        {
          ordinal: 0,
          text: 'Erster Satz.\n\nZweiter Satz.',
          startOffset: 0,
          endOffset: 'Erster Satz.\n\nZweiter Satz.'.length,
          embedding: vector(1),
        },
      ],
    });
  });

  it('marks the source as PROCESSING before it parses', async () => {
    let statusWhileParsing = '';
    const { ports, rows } = fakePorts({
      parse: async () => {
        statusWhileParsing = rows[0]?.status ?? '';
        return { text: 'Text', pageCount: null };
      },
    });
    await registerSource(input, ports);

    await processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports);

    expect(statusWhileParsing).toBe(SOURCE_STATUS.PROCESSING);
  });

  it('embeds in batches of the configured size and keeps the order', async () => {
    const text = Array.from({ length: 900 }, (_, i) => `wort${i}`).join(' ');
    const { ports, calls } = fakePorts({ parse: async () => ({ text, pageCount: null }) });
    await registerSource(input, ports);

    await processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports);

    const flat = calls.embed.flat();
    expect(calls.embed.length).toBeGreaterThan(0);
    for (const batch of calls.embed) {
      expect(batch.length).toBeLessThanOrEqual(LIMITS.EMBED_BATCH_SIZE);
    }
    const stored = calls.ready[0] as { chunks: { text: string }[] };
    expect(flat).toEqual(stored.chunks.map((chunk) => chunk.text));
  });

  it('fails with EMPTY_TEXT when the parser finds no text', async () => {
    const { ports, calls, rows } = fakePorts({
      parse: async () => ({ text: ' \n ', pageCount: 1 }),
    });
    await registerSource(input, ports);

    await expect(
      processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports)
    ).rejects.toMatchObject({ code: INGEST_ERROR.EMPTY_TEXT });

    expect(rows[0]?.status).toBe(SOURCE_STATUS.FAILED);
    expect(calls.failed).toEqual([SOURCE_FAILURE.EMPTY_TEXT]);
    expect(calls.embed).toEqual([]);
  });

  it('fails with PARSE_FAILED and keeps the cause when the parser throws', async () => {
    const cause = new Error('kaputtes PDF');
    const { ports, calls } = fakePorts({
      parse: async () => {
        throw cause;
      },
    });
    await registerSource(input, ports);

    const error = await processSource(
      { sourceId: 's1', kind: SOURCE_KIND.PDF, bytes: BYTES },
      ports
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(IngestError);
    expect((error as IngestError).code).toBe(INGEST_ERROR.PARSE_FAILED);
    expect((error as IngestError).cause).toBe(cause);
    expect(calls.failed).toEqual([SOURCE_FAILURE.PARSE_FAILED]);
  });

  it('fails with EMBED_FAILED when the embedder throws', async () => {
    const { ports, calls } = fakePorts({
      embed: async () => {
        throw new Error('429');
      },
    });
    await registerSource(input, ports);

    await expect(
      processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports)
    ).rejects.toMatchObject({ code: INGEST_ERROR.EMBED_FAILED });
    expect(calls.failed).toEqual([SOURCE_FAILURE.EMBED_FAILED]);
    expect(calls.ready).toEqual([]);
  });

  it('fails with EMBED_FAILED when the embedder returns the wrong number of vectors', async () => {
    const { ports, calls } = fakePorts({ embed: async () => [] });
    await registerSource(input, ports);

    await expect(
      processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports)
    ).rejects.toMatchObject({ code: INGEST_ERROR.EMBED_FAILED });
    expect(calls.ready).toEqual([]);
  });

  it('fails with EMBED_FAILED when a vector has the wrong size', async () => {
    const { ports } = fakePorts({ embed: async (texts) => texts.map(() => [1, 2, 3]) });
    await registerSource(input, ports);

    await expect(
      processSource({ sourceId: 's1', kind: SOURCE_KIND.TXT, bytes: BYTES }, ports)
    ).rejects.toMatchObject({ code: INGEST_ERROR.EMBED_FAILED });
  });
});
