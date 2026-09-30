import {
  CHAT_STYLE,
  DEFAULT_CHAT_CONFIG,
  type NewStudioOutput,
  REPORT_FORMAT,
  SOURCE_KIND,
  SOURCE_STATUS,
  STUDIO_KIND,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getChatConfig, setChatConfig } from './chat-config-repository';
import { chunks, notebooks, notebookSources, sources } from './schema';
import {
  createStudioOutput,
  deleteStudioOutput,
  listStudioOutputs,
  loadStudioChunks,
} from './studio-repository';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const FAQ_TITLE = 'Häufige Fragen';
const USER = 'studio-user-a';
const OTHER_USER = 'studio-user-b';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const CHUNK_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';

const flashcards: NewStudioOutput = {
  kind: STUDIO_KIND.FLASHCARDS,
  title: 'Karteikarten',
  content: { cards: [{ front: 'F', back: 'B', chunkIds: [CHUNK_ID] }] },
};

async function insertNotebook(userId: string) {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'N' }).returning();
  if (!notebook) throw new Error('insert returned no row');
  return notebook;
}

async function insertSource(
  userId: string,
  notebookId: string,
  options: { texts: string[]; selected?: boolean; status?: string } = { texts: [] }
) {
  const [source] = await db
    .insert(sources)
    .values({
      userId,
      contentHash: `${userId}-${Math.random()}`,
      kind: SOURCE_KIND.TXT,
      title: 'Quelle',
      status:
        options.status === SOURCE_STATUS.PENDING ? SOURCE_STATUS.PENDING : SOURCE_STATUS.READY,
      canonicalText: options.texts.join(''),
    })
    .returning();
  if (!source) throw new Error('insert returned no row');
  await db
    .insert(notebookSources)
    .values({ notebookId, sourceId: source.id, selected: options.selected ?? true });
  for (const [ordinal, text] of options.texts.entries()) {
    await db
      .insert(chunks)
      .values({ sourceId: source.id, ordinal, text, startOffset: 0, endOffset: text.length });
  }
  return source;
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [USER, OTHER_USER]);
});

afterAll(async () => {
  await pool.end();
});

describe('studio outputs', () => {
  it('saves an output and lists the newest first, with the content back as it was', async () => {
    const notebook = await insertNotebook(USER);
    const first = await createStudioOutput(db, USER, notebook.id, flashcards);
    const second = await createStudioOutput(db, USER, notebook.id, {
      kind: STUDIO_KIND.REPORT,
      format: REPORT_FORMAT.FAQ,
      title: FAQ_TITLE,
      content: {
        title: FAQ_TITLE,
        sections: [{ heading: 'H', statements: [{ text: 'T.', chunkIds: [CHUNK_ID] }] }],
      },
    });

    const list = await listStudioOutputs(db, USER, notebook.id);

    expect(list.map((output) => output.id)).toEqual([second?.id, first?.id]);
    expect(list[1]).toMatchObject(flashcards);
    expect(list[0]).toMatchObject({ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ });
  });

  it('does not save into, list from or delete in a notebook of another user', async () => {
    const notebook = await insertNotebook(USER);
    const output = await createStudioOutput(db, USER, notebook.id, flashcards);
    if (!output) throw new Error('no output');

    expect(await createStudioOutput(db, OTHER_USER, notebook.id, flashcards)).toBeNull();
    expect(await listStudioOutputs(db, OTHER_USER, notebook.id)).toEqual([]);
    expect(await deleteStudioOutput(db, OTHER_USER, notebook.id, output.id)).toBe(false);
    expect(await listStudioOutputs(db, USER, notebook.id)).toHaveLength(1);
  });

  it('deletes an output and answers false for one that is not there', async () => {
    const notebook = await insertNotebook(USER);
    const output = await createStudioOutput(db, USER, notebook.id, flashcards);
    if (!output) throw new Error('no output');

    expect(await deleteStudioOutput(db, USER, notebook.id, output.id)).toBe(true);
    expect(await deleteStudioOutput(db, USER, notebook.id, output.id)).toBe(false);
    expect(await deleteStudioOutput(db, USER, notebook.id, 'kein-uuid')).toBe(false);
    expect(await deleteStudioOutput(db, USER, notebook.id, UNKNOWN_ID)).toBe(false);
  });
});

describe('loadStudioChunks', () => {
  it('returns the chunks of the selected, ready sources in reading order', async () => {
    const notebook = await insertNotebook(USER);
    await insertSource(USER, notebook.id, { texts: ['A1', 'A2'] });
    await insertSource(USER, notebook.id, { texts: ['B1'] });
    await insertSource(USER, notebook.id, { texts: ['nicht gewählt'], selected: false });
    await insertSource(USER, notebook.id, {
      texts: ['noch nicht fertig'],
      status: SOURCE_STATUS.PENDING,
    });

    const found = await loadStudioChunks(db, USER, notebook.id, 10_000);

    expect(found.map((chunk) => chunk.text)).toEqual(['A1', 'A2', 'B1']);
  });

  it('shares the character budget between the sources and keeps the start of each', async () => {
    const notebook = await insertNotebook(USER);
    await insertSource(USER, notebook.id, { texts: ['aaaa', 'aaaa', 'aaaa'] });
    await insertSource(USER, notebook.id, { texts: ['bbbb', 'bbbb', 'bbbb'] });

    const found = await loadStudioChunks(db, USER, notebook.id, 16);

    expect(found.map((chunk) => chunk.text)).toEqual(['aaaa', 'aaaa', 'bbbb', 'bbbb']);
  });

  it('never returns chunks of another user, even for a known notebook ID', async () => {
    const notebook = await insertNotebook(USER);
    await insertSource(USER, notebook.id, { texts: ['geheim'] });

    expect(await loadStudioChunks(db, OTHER_USER, notebook.id, 10_000)).toEqual([]);
    expect(await loadStudioChunks(db, USER, 'kein-uuid', 10_000)).toEqual([]);
  });
});

describe('chat config', () => {
  it('is the default until one is saved, then returns what was saved', async () => {
    const notebook = await insertNotebook(USER);
    const config = { ...DEFAULT_CHAT_CONFIG, style: CHAT_STYLE.LEARNING_GUIDE };

    expect(await getChatConfig(db, USER, notebook.id)).toEqual(DEFAULT_CHAT_CONFIG);
    expect(await setChatConfig(db, USER, notebook.id, config)).toEqual(config);
    expect(await getChatConfig(db, USER, notebook.id)).toEqual(config);
  });

  it('is not readable or writable for a notebook of another user', async () => {
    const notebook = await insertNotebook(USER);

    expect(await getChatConfig(db, OTHER_USER, notebook.id)).toBeNull();
    expect(await setChatConfig(db, OTHER_USER, notebook.id, DEFAULT_CHAT_CONFIG)).toBeNull();
    expect(await getChatConfig(db, USER, 'kein-uuid')).toBeNull();
  });
});
