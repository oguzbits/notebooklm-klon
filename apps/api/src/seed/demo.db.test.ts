import { EMBEDDING_DIMENSIONS, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { ChatInput } from '../ai/gemini-chat';
import { findNotebookForOverview, saveNotebookOverview } from '../db/notebook-overview-repository';
import { linkSource, listNotebooks, listNotebookSources } from '../db/notebook-repository';
import { findSourceForOverview, saveOverview } from '../db/overview-repository';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import { axisVector, createTestDb, ensureUsers } from '../db/testing/test-db';
import type { LocalFile } from '../ingestion/local-import';
import { DEMO_NOTEBOOK_TITLE, seedDemo } from './demo';

const { db, pool } = createTestDb();
const USER = 'demo-user';
const encode = (text: string) => new TextEncoder().encode(text);
const files: LocalFile[] = [
  { name: 'eins.md', kind: SOURCE_KIND.MD, bytes: encode('Erstes Dokument.'), sourceUrl: null },
  { name: 'zwei.md', kind: SOURCE_KIND.MD, bytes: encode('Zweites Dokument.'), sourceUrl: null },
];
const OVERVIEW = { summary: 'Kurz.', keyTopics: ['A'], suggestedQuestions: ['Was?'] };
const NOTEBOOK_OVERVIEW = { emoji: '📚', summary: 'Zwei **Dokumente**.' };

let modelCalls: ChatInput[] = [];
let notebookModelCalls: ChatInput[] = [];
const deps = {
  importDeps: {
    ports: {
      sources: createSourceStorage(db),
      uploads: createUploadStorage(db),
      parse: async (_kind: unknown, bytes: Uint8Array) => ({
        text: new TextDecoder().decode(bytes),
        pageCount: null,
      }),
      embed: async (texts: string[]) => texts.map(() => axisVector(0, EMBEDDING_DIMENSIONS)),
    },
    link: (userId: string, notebookId: string, sourceId: string) =>
      linkSource(db, userId, notebookId, sourceId),
  },
  overview: {
    find: (userId: string, notebookId: string, sourceId: string) =>
      findSourceForOverview(db, userId, notebookId, sourceId),
    save: (userId: string, sourceId: string, overview: typeof OVERVIEW) =>
      saveOverview(db, userId, sourceId, overview),
    stream: async function* (input: ChatInput) {
      modelCalls.push(input);
      yield JSON.stringify(OVERVIEW);
    },
  },
  notebookOverview: {
    find: (userId: string, notebookId: string) => findNotebookForOverview(db, userId, notebookId),
    save: (userId: string, notebookId: string, overview: typeof NOTEBOOK_OVERVIEW, key: string) =>
      saveNotebookOverview(db, userId, notebookId, overview, key),
    stream: async function* (input: ChatInput) {
      notebookModelCalls.push(input);
      yield JSON.stringify(NOTEBOOK_OVERVIEW);
    },
  },
  ensureUser: async () => {
    await ensureUsers(pool, [USER]);
    return USER;
  },
  db,
};

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  modelCalls = [];
  notebookModelCalls = [];
});

afterAll(async () => {
  await pool.end();
});

describe('seedDemo', () => {
  it('makes the demo notebook with ready sources and their overviews', async () => {
    const result = await seedDemo({ files }, deps);

    expect(result.userId).toBe(USER);
    const [notebook] = await listNotebooks(db, USER);
    expect(notebook?.title).toBe(DEMO_NOTEBOOK_TITLE);
    const sources = await listNotebookSources(db, USER, notebook?.id ?? '');
    expect(sources.map((source) => source.status)).toEqual([
      SOURCE_STATUS.READY,
      SOURCE_STATUS.READY,
    ]);
    expect(modelCalls).toHaveLength(2);
    for (const source of sources) {
      const stored = await findSourceForOverview(db, USER, notebook?.id ?? '', source.id);
      expect(stored?.overview).toEqual(OVERVIEW);
    }
  });

  it('gives the notebook its own overview, so the first visit shows it at once', async () => {
    await seedDemo({ files }, deps);

    const [notebook] = await listNotebooks(db, USER);
    expect(notebookModelCalls).toHaveLength(1);
    expect(notebook?.emoji).toBe('📚');
    const found = await findNotebookForOverview(db, USER, notebook?.id ?? '');
    expect(found?.stored?.overview).toEqual(NOTEBOOK_OVERVIEW);
  });

  it('can run again without a second notebook and without another model call', async () => {
    await seedDemo({ files }, deps);
    modelCalls = [];
    notebookModelCalls = [];

    await seedDemo({ files }, deps);

    expect(await listNotebooks(db, USER)).toHaveLength(1);
    expect(modelCalls).toEqual([]);
    expect(notebookModelCalls).toEqual([]);
  });
});
