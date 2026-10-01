import { CHAT_ROLE, NOTE_KIND } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createNoteFromMessage,
  createWrittenNote,
  deleteNote,
  listNotes,
  updateNote,
} from './note-repository';
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

    expect(note).toMatchObject({
      kind: NOTE_KIND.ANSWER,
      title: null,
      messageId,
      statements: STATEMENTS,
    });
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

    expect(
      notes.map((note) => (note.kind === NOTE_KIND.ANSWER ? note.statements[0]?.text : null))
    ).toEqual(['Neu.', 'Alt.']);
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

  describe('written notes', () => {
    it('makes an empty note of the reader, each time a new one', async () => {
      const notebook = await insertNotebook(USER);

      const first = await createWrittenNote(db, USER, notebook.id);
      const second = await createWrittenNote(db, USER, notebook.id);

      expect(first).toMatchObject({ kind: NOTE_KIND.WRITTEN, title: null, body: '' });
      expect(second?.id).not.toBe(first?.id);
      expect(await listNotes(db, USER, notebook.id)).toHaveLength(2);
    });

    it('can start with a title and a text, which is how a saved summary becomes a note', async () => {
      const notebook = await insertNotebook(USER);

      const note = await createWrittenNote(db, USER, notebook.id, {
        title: 'Zusammenfassung',
        body: 'Es geht um **Nordlicht**.',
      });

      expect(note).toMatchObject({
        kind: NOTE_KIND.WRITTEN,
        title: 'Zusammenfassung',
        body: 'Es geht um **Nordlicht**.',
      });
      expect(await listNotes(db, USER, notebook.id)).toEqual([note]);
    });

    it('starts with the part that is given and leaves the other empty', async () => {
      const notebook = await insertNotebook(USER);

      const onlyText = await createWrittenNote(db, USER, notebook.id, { body: 'Nur Text.' });
      const onlyTitle = await createWrittenNote(db, USER, notebook.id, { title: 'Nur Titel' });

      expect(onlyText).toMatchObject({ title: null, body: 'Nur Text.' });
      expect(onlyTitle).toMatchObject({ title: 'Nur Titel', body: '' });
    });

    it('makes no note in the notebook of another user or in an unknown one', async () => {
      const foreign = await insertNotebook(OTHER_USER);

      expect(await createWrittenNote(db, USER, foreign.id)).toBeNull();
      expect(await createWrittenNote(db, USER, 'kein-uuid')).toBeNull();
      expect(await listNotes(db, OTHER_USER, foreign.id)).toEqual([]);
    });

    it('lists them with the saved answers, newest first', async () => {
      const notebook = await insertNotebook(USER);
      await createNoteFromMessage(db, USER, notebook.id, await answered(USER, notebook.id));
      await createWrittenNote(db, USER, notebook.id);

      const kinds = (await listNotes(db, USER, notebook.id)).map((note) => note.kind);

      expect(kinds).toEqual([NOTE_KIND.WRITTEN, NOTE_KIND.ANSWER]);
    });

    it('changes the title and the text and hands back the note', async () => {
      const notebook = await insertNotebook(USER);
      const note = await createWrittenNote(db, USER, notebook.id);
      if (!note) throw new Error('expected a note');

      const renamed = await updateNote(db, USER, notebook.id, note.id, { title: 'Ideen' });
      const written = await updateNote(db, USER, notebook.id, note.id, {
        body: '# Ideen\n\n**Eins**',
      });

      expect(renamed).toMatchObject({ title: 'Ideen', body: '' });
      expect(written).toMatchObject({ title: 'Ideen', body: '# Ideen\n\n**Eins**' });
      expect(await listNotes(db, USER, notebook.id)).toEqual([written]);
    });

    it('lets the reader name a saved answer, but never rewrite it', async () => {
      const notebook = await insertNotebook(USER);
      const note = await createNoteFromMessage(
        db,
        USER,
        notebook.id,
        await answered(USER, notebook.id)
      );
      if (!note) throw new Error('expected a note');

      expect(await updateNote(db, USER, notebook.id, note.id, { body: 'Neu' })).toBeNull();
      expect(
        await updateNote(db, USER, notebook.id, note.id, { title: 'Meine Antwort' })
      ).toMatchObject({
        kind: NOTE_KIND.ANSWER,
        title: 'Meine Antwort',
        statements: STATEMENTS,
      });
    });

    it('changes nothing of another user, in another notebook, or with a bad ID', async () => {
      const notebook = await insertNotebook(USER);
      const other = await insertNotebook(USER);
      const note = await createWrittenNote(db, USER, notebook.id);
      if (!note) throw new Error('expected a note');

      expect(await updateNote(db, OTHER_USER, notebook.id, note.id, { body: 'x' })).toBeNull();
      expect(await updateNote(db, USER, other.id, note.id, { body: 'x' })).toBeNull();
      expect(await updateNote(db, USER, notebook.id, 'kein-uuid', { body: 'x' })).toBeNull();
      expect(await listNotes(db, USER, notebook.id)).toEqual([note]);
    });
  });
});
