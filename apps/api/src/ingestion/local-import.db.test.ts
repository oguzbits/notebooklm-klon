import { EMBEDDING_DIMENSIONS, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createNotebook, linkSource, listNotebookSources } from '../db/notebook-repository';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import { axisVector, createTestDb, ensureUsers } from '../db/testing/test-db';
import { importLocalFiles, type LocalFile } from './local-import';

const { db, pool } = createTestDb();
const USER = 'import-user';
const encode = (text: string) => new TextEncoder().encode(text);

let embedded = 0;
const deps = {
  ports: {
    sources: createSourceStorage(db),
    uploads: createUploadStorage(db),
    parse: async (_kind: unknown, bytes: Uint8Array) => ({
      text: new TextDecoder().decode(bytes),
      pageCount: null,
    }),
    embed: async (texts: string[]) => {
      embedded += texts.length;
      return texts.map(() => axisVector(0, EMBEDDING_DIMENSIONS));
    },
  },
  link: (userId: string, notebookId: string, sourceId: string) =>
    linkSource(db, userId, notebookId, sourceId),
};

const files: LocalFile[] = [
  { name: 'eins.txt', kind: SOURCE_KIND.TXT, bytes: encode('Der erste Text.'), sourceUrl: null },
  { name: 'zwei.md', kind: SOURCE_KIND.MD, bytes: encode('Der zweite Text.'), sourceUrl: null },
];

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [USER]);
  embedded = 0;
});

afterAll(async () => {
  await pool.end();
});

describe('importLocalFiles', () => {
  it('reads every file, puts it into the notebook and names the source of each file', async () => {
    const notebook = await createNotebook(db, USER, 'N');

    const ids = await importLocalFiles({ userId: USER, notebookId: notebook.id, files }, deps);

    expect([...ids.keys()]).toEqual(['eins.txt', 'zwei.md']);
    const sources = await listNotebookSources(db, USER, notebook.id);
    expect(sources.map((source) => [source.id, source.status])).toEqual([
      [ids.get('eins.txt'), SOURCE_STATUS.READY],
      [ids.get('zwei.md'), SOURCE_STATUS.READY],
    ]);
  });

  it('does not read or embed the same content twice, not even for another notebook', async () => {
    const first = await createNotebook(db, USER, 'Eins');
    const second = await createNotebook(db, USER, 'Zwei');
    await importLocalFiles({ userId: USER, notebookId: first.id, files }, deps);
    const embeddedAfterFirst = embedded;

    const ids = await importLocalFiles({ userId: USER, notebookId: second.id, files }, deps);

    expect(embedded).toBe(embeddedAfterFirst);
    expect(await listNotebookSources(db, USER, second.id)).toHaveLength(2);
    expect(ids.size).toBe(2);
  });

  it('is not held back by the quota for new sources', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const many = Array.from({ length: 12 }, (_, index) => ({
      name: `datei-${index}.txt`,
      kind: SOURCE_KIND.TXT,
      bytes: encode(`Text Nummer ${index}.`),
      sourceUrl: null,
    }));

    const ids = await importLocalFiles(
      { userId: USER, notebookId: notebook.id, files: many },
      deps
    );

    expect(ids.size).toBe(12);
  });

  it('finishes the files an earlier, aborted run left unread', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const failingOnce = {
      ...deps,
      ports: {
        ...deps.ports,
        parse: async () => {
          throw new Error('kaputt');
        },
      },
    };
    await expect(
      importLocalFiles({ userId: USER, notebookId: notebook.id, files }, failingOnce)
    ).rejects.toThrow();

    await importLocalFiles({ userId: USER, notebookId: notebook.id, files }, deps);

    const sources = await listNotebookSources(db, USER, notebook.id);
    expect(sources.map((source) => source.status)).toEqual([
      SOURCE_STATUS.READY,
      SOURCE_STATUS.READY,
    ]);
  });

  it('throws when a file cannot be read, so a broken seed is noticed', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const failing = {
      ...deps,
      ports: {
        ...deps.ports,
        parse: async () => {
          throw new Error('kaputt');
        },
      },
    };

    await expect(
      importLocalFiles({ userId: USER, notebookId: notebook.id, files }, failing)
    ).rejects.toThrow();
  });
});
