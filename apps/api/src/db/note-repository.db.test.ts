import { CHAT_ROLE } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createNoteFromMessage, deleteNote, listNotes } from './note-repository';
import { saveAssistantMessage, saveUserMessage } from './reader-repository';
import { notebooks } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'note-user-a';
const OTHER_USER = 'note-user-b';
const STATEMENTS = [{ text: 'Dr. Brandt leitet es.', chunkIds: ['a'] }];

async function insertNotebook(userId: string) {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'N' }).returning();
  if (!notebook) throw new Error('insert returned no row');
  return notebook;
}

/** Saves a question and its answer, and returns the ID of the answer. */
async function answered(userId: string, notebookId: string, statements = STATEMENTS) {
  await saveUserMessage(db, userId, notebookId, 'Frage?');
  await saveAssistantMessage(db, userId, notebookId, statements);
  const { rows } = await pool.query(
    'SELECT id FROM chat_messages WHERE notebook_id = $1 AND role = $2 ORDER BY seq DESC LIMIT 1',
    [notebookId, CHAT_ROLE.ASSISTANT]
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [USER, OTHER_USER]);
});

afterAll(async () => {
  await pool.end();
});

describe('notes', () => {
  it('copies the statements of a saved answer into a note', async () => {
    const notebook = await insertNotebook(USER);
    const messageId = await answered(USER, notebook.id);

    const note = await createNoteFromMessage(db, USER, notebook.id, messageId);

    expect(note).toMatchObject({ messageId, statements: STATEMENTS });
    expect(await listNotes(db, USER, notebook.id)).toEqual([note]);
  });

  it('gives the same note when the same answer is saved twice', async () => {
    const notebook = await insertNotebook(USER);
    const messageId = await answered(USER, notebook.id);

    const first = await createNoteFromMessage(db, USER, notebook.id, messageId);
    const second = await createNoteFromMessage(db, USER, notebook.id, messageId);

    expect(second?.id).toBe(first?.id);
    expect(await listNotes(db, USER, notebook.id)).toHaveLength(1);
  });

  it('refuses a question, an answer without statements, an unknown ID and the answer of another user', async () => {
    const notebook = await insertNotebook(USER);
    const foreign = await insertNotebook(OTHER_USER);
    const empty = await answered(USER, notebook.id, []);
    const theirs = await answered(OTHER_USER, foreign.id);
    const { rows } = await pool.query(
      'SELECT id FROM chat_messages WHERE notebook_id = $1 AND role = $2',
      [notebook.id, CHAT_ROLE.USER]
    );

    expect(await createNoteFromMessage(db, USER, notebook.id, rows[0].id)).toBeNull();
    expect(await createNoteFromMessage(db, USER, notebook.id, empty)).toBeNull();
    expect(await createNoteFromMessage(db, USER, notebook.id, theirs)).toBeNull();
    expect(await createNoteFromMessage(db, USER, foreign.id, theirs)).toBeNull();
    expect(await createNoteFromMessage(db, USER, notebook.id, 'kein-uuid')).toBeNull();
    expect(await listNotes(db, USER, notebook.id)).toEqual([]);
  });

  it('lists only the notes of the notebook and the user, newest first', async () => {
    const first = await insertNotebook(USER);
    const second = await insertNotebook(USER);
    const oldMessage = await answered(USER, first.id, [{ text: 'Alt.', chunkIds: ['a'] }]);
    const newMessage = await answered(USER, first.id, [{ text: 'Neu.', chunkIds: ['b'] }]);
    await createNoteFromMessage(db, USER, first.id, oldMessage);
    await createNoteFromMessage(db, USER, first.id, newMessage);
    await createNoteFromMessage(db, USER, second.id, await answered(USER, second.id));

    const notes = await listNotes(db, USER, first.id);

    expect(notes.map((note) => note.statements[0]?.text)).toEqual(['Neu.', 'Alt.']);
    expect(await listNotes(db, OTHER_USER, first.id)).toEqual([]);
    expect(await listNotes(db, USER, 'kein-uuid')).toEqual([]);
  });

  it('deletes an own note and nobody else’s', async () => {
    const notebook = await insertNotebook(USER);
    const note = await createNoteFromMessage(
      db,
      USER,
      notebook.id,
      await answered(USER, notebook.id)
    );
    if (!note) throw new Error('expected a note');

    expect(await deleteNote(db, OTHER_USER, notebook.id, note.id)).toBe(false);
    expect(await deleteNote(db, USER, notebook.id, 'kein-uuid')).toBe(false);
    expect(await deleteNote(db, USER, notebook.id, note.id)).toBe(true);
    expect(await deleteNote(db, USER, notebook.id, note.id)).toBe(false);
  });
});
