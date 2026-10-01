import { CHAT_ROLE, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearChatMessages,
  findChunkDetail,
  findSourceText,
  listChatMessages,
  saveAssistantMessage,
  saveUserMessage,
} from './reader-repository';
import { chunks, notebooks, notebookSources, sources } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'reader-user-a';
const OTHER_USER = 'reader-user-b';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const TEXT = 'Erster Absatz.\n\nZweiter Absatz.';

async function insertNotebook(userId: string) {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'Notizbuch' }).returning();
  if (!notebook) throw new Error('insert returned no row');
  return notebook;
}

async function insertSource(userId: string, notebookId: string | null, canonicalText = TEXT) {
  const [source] = await db
    .insert(sources)
    .values({
      userId,
      contentHash: `${userId}-${Math.random()}`,
      kind: SOURCE_KIND.URL,
      title: 'Quelle',
      sourceUrl: 'https://example.test/a',
      status: SOURCE_STATUS.READY,
      canonicalText,
    })
    .returning();
  if (!source) throw new Error('insert returned no row');
  if (notebookId) await db.insert(notebookSources).values({ notebookId, sourceId: source.id });
  return source;
}

async function insertChunk(sourceId: string) {
  const [chunk] = await db
    .insert(chunks)
    .values({ sourceId, ordinal: 0, text: 'Zweiter Absatz.', startOffset: 16, endOffset: 31 })
    .returning();
  if (!chunk) throw new Error('insert returned no row');
  return chunk;
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [USER, OTHER_USER]);
});

afterAll(async () => {
  await pool.end();
});

describe('findChunkDetail', () => {
  it('returns the passage with the title of its source and its offsets', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id);
    const chunk = await insertChunk(source.id);

    const detail = await findChunkDetail(db, USER, notebook.id, chunk.id);

    expect(detail).toEqual({
      id: chunk.id,
      sourceId: source.id,
      sourceTitle: 'Quelle',
      sourceKind: SOURCE_KIND.URL,
      text: 'Zweiter Absatz.',
      startOffset: 16,
      endOffset: 31,
    });
  });

  it("does not return another user's chunk, even through the own notebook", async () => {
    const notebook = await insertNotebook(USER);
    const foreign = await insertSource(OTHER_USER, null);
    const chunk = await insertChunk(foreign.id);

    expect(await findChunkDetail(db, USER, notebook.id, chunk.id)).toBeNull();
  });

  it('does not return a chunk of a source that is not part of the notebook', async () => {
    const notebook = await insertNotebook(USER);
    const elsewhere = await insertSource(USER, null);
    const chunk = await insertChunk(elsewhere.id);

    expect(await findChunkDetail(db, USER, notebook.id, chunk.id)).toBeNull();
  });

  it('returns null for an unknown or malformed ID', async () => {
    const notebook = await insertNotebook(USER);

    expect(await findChunkDetail(db, USER, notebook.id, UNKNOWN_ID)).toBeNull();
    expect(await findChunkDetail(db, USER, notebook.id, 'kein-uuid')).toBeNull();
  });
});

describe('findSourceText', () => {
  it('returns the extracted text with title, kind and address', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id);

    expect(await findSourceText(db, USER, notebook.id, source.id)).toEqual({
      id: source.id,
      title: 'Quelle',
      kind: SOURCE_KIND.URL,
      sourceUrl: 'https://example.test/a',
      text: TEXT,
    });
  });

  it('returns null while the source has no text yet', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id);
    await pool.query('UPDATE sources SET canonical_text = NULL WHERE id = $1', [source.id]);

    expect(await findSourceText(db, USER, notebook.id, source.id)).toBeNull();
  });

  it("returns null for another user's source and for one outside the notebook", async () => {
    const notebook = await insertNotebook(USER);
    const foreign = await insertSource(OTHER_USER, null);
    const elsewhere = await insertSource(USER, null);

    expect(await findSourceText(db, USER, notebook.id, foreign.id)).toBeNull();
    expect(await findSourceText(db, USER, notebook.id, elsewhere.id)).toBeNull();
    expect(await findSourceText(db, USER, notebook.id, 'kein-uuid')).toBeNull();
  });
});

describe('chat messages', () => {
  it('lists the messages of a notebook in the order they were saved', async () => {
    const notebook = await insertNotebook(USER);
    await saveUserMessage(db, USER, notebook.id, 'Wer leitet es?');
    await saveAssistantMessage(db, USER, notebook.id, {
      statements: [{ text: 'Dr. Brandt.', chunkIds: ['a'] }],
    });
    await saveUserMessage(db, USER, notebook.id, 'Und wann?');

    const messages = await listChatMessages(db, USER, notebook.id);

    expect(messages.map((message) => message.role)).toEqual([
      CHAT_ROLE.USER,
      CHAT_ROLE.ASSISTANT,
      CHAT_ROLE.USER,
    ]);
    expect(messages[0]).toMatchObject({ text: 'Wer leitet es?' });
    expect(messages[1]).toMatchObject({ statements: [{ text: 'Dr. Brandt.', chunkIds: ['a'] }] });
  });

  it('keeps the questions an answer suggested, and none for an answer without', async () => {
    const notebook = await insertNotebook(USER);
    await saveAssistantMessage(db, USER, notebook.id, {
      statements: [{ text: 'Dr. Brandt.', chunkIds: ['a'] }],
      followUps: ['Wie lange läuft das Projekt?', 'Wer ist noch beteiligt?'],
    });
    await saveAssistantMessage(db, USER, notebook.id, {
      statements: [{ text: 'Frau Weiß.', chunkIds: ['a'] }],
    });

    const [first, second] = await listChatMessages(db, USER, notebook.id);

    expect(first).toMatchObject({
      followUps: ['Wie lange läuft das Projekt?', 'Wer ist noch beteiligt?'],
    });
    expect(second).toMatchObject({ followUps: [] });
  });

  it('keeps the histories of two notebooks and two users apart', async () => {
    const first = await insertNotebook(USER);
    const second = await insertNotebook(USER);
    const foreign = await insertNotebook(OTHER_USER);
    await saveUserMessage(db, USER, first.id, 'Erste');
    await saveUserMessage(db, USER, second.id, 'Zweite');
    await saveUserMessage(db, OTHER_USER, foreign.id, 'Fremde');

    expect(await listChatMessages(db, USER, first.id)).toMatchObject([{ text: 'Erste' }]);
    expect(await listChatMessages(db, USER, foreign.id)).toEqual([]);
    expect(await listChatMessages(db, USER, 'kein-uuid')).toEqual([]);
  });

  it('does not save into a notebook of another user', async () => {
    const foreign = await insertNotebook(OTHER_USER);

    await expect(saveUserMessage(db, USER, foreign.id, 'Einbruch')).rejects.toThrow();
    expect(await listChatMessages(db, OTHER_USER, foreign.id)).toEqual([]);
  });
});

describe('clearChatMessages', () => {
  it('deletes the history of one notebook and leaves the others', async () => {
    const first = await insertNotebook(USER);
    const second = await insertNotebook(USER);
    for (const notebook of [first, second]) {
      await pool.query(
        'INSERT INTO chat_messages (notebook_id, user_id, role, text) VALUES ($1, $2, $3, $4)',
        [notebook.id, USER, CHAT_ROLE.USER, 'Frage']
      );
    }

    expect(await clearChatMessages(db, USER, first.id)).toBe(true);

    expect(await listChatMessages(db, USER, first.id)).toEqual([]);
    expect(await listChatMessages(db, USER, second.id)).toHaveLength(1);
  });

  it("does not touch another user's history and says so for an unknown notebook", async () => {
    const theirs = await insertNotebook(OTHER_USER);
    await pool.query(
      'INSERT INTO chat_messages (notebook_id, user_id, role, text) VALUES ($1, $2, $3, $4)',
      [theirs.id, OTHER_USER, CHAT_ROLE.USER, 'Frage']
    );

    expect(await clearChatMessages(db, USER, theirs.id)).toBe(false);
    expect(await clearChatMessages(db, USER, 'kein-uuid')).toBe(false);
    expect(await listChatMessages(db, OTHER_USER, theirs.id)).toHaveLength(1);
  });
});
