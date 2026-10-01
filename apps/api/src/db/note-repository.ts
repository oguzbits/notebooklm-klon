import { CHAT_ROLE, type Note, NOTE_KIND, NoteSchema, type NoteUpdateBody } from '@nlm/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Database } from './client';
import { notes } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NoteRow = {
  id: string;
  kind: string;
  title: string | null;
  messageId: string | null;
  statements: unknown;
  body: string | null;
  createdAt: Date;
};

// A stored note that does not fit the contract is a bug, not a case to skip: parse throws. The
// union takes what its kind needs and drops the rest (a written note has no statements).
const toNote = (row: NoteRow): Note =>
  NoteSchema.parse({
    id: row.id,
    kind: row.kind,
    title: row.title,
    messageId: row.messageId,
    statements: row.statements,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  });

/** What the raw INSERT ... RETURNING statements below hand back. */
type RawNoteRow = {
  id: string;
  kind: string;
  title: string | null;
  message_id: string | null;
  statements: unknown;
  body: string | null;
  // Drizzle's driver hands raw timestamps out as text, not as Date.
  created_at: string;
};

const fromRaw = (row: RawNoteRow): Note =>
  toNote({
    id: row.id,
    kind: row.kind,
    title: row.title,
    messageId: row.message_id,
    statements: row.statements,
    body: row.body,
    createdAt: new Date(row.created_at),
  });

const noteColumns = {
  id: notes.id,
  kind: notes.kind,
  title: notes.title,
  messageId: notes.messageId,
  statements: notes.statements,
  body: notes.body,
  createdAt: notes.createdAt,
};

/** Every function below takes the user ID from the session and filters by it in SQL. */

/**
 * Turns a saved answer into a note by copying its statements in SQL, so the client never supplies
 * the content. Null when there is no such answer of this user in this notebook, or it has no
 * statements. Saving the same answer again returns the note that already exists.
 */
export async function createNoteFromMessage(
  db: Database,
  userId: string,
  notebookId: string,
  messageId: string
): Promise<Note | null> {
  if (!UUID.test(notebookId) || !UUID.test(messageId)) return null;
  const result = await db.execute<RawNoteRow>(sql`
    INSERT INTO notes (notebook_id, user_id, message_id, statements)
    SELECT m.notebook_id, m.user_id, m.id, m.statements
    FROM chat_messages m
    WHERE m.id = ${messageId} AND m.notebook_id = ${notebookId} AND m.user_id = ${userId}
      AND m.role = ${CHAT_ROLE.ASSISTANT}::chat_role
      AND jsonb_array_length(m.statements) > 0
    ON CONFLICT (message_id) DO UPDATE SET message_id = EXCLUDED.message_id
    RETURNING id, kind, title, message_id, statements, body, created_at`);
  const row = result.rows[0];
  return row ? fromRaw(row) : null;
}

/**
 * Makes a note of the reader in one of their notebooks, empty or with a title and a text to start
 * from. Null when the notebook is not theirs (checked in the same statement). Every call makes a
 * new note, there is nothing to deduplicate.
 */
export async function createWrittenNote(
  db: Database,
  userId: string,
  notebookId: string,
  start: { title?: string; body?: string } = {}
): Promise<Note | null> {
  if (!UUID.test(notebookId)) return null;
  const result = await db.execute<RawNoteRow>(sql`
    INSERT INTO notes (notebook_id, user_id, kind, statements, title, body)
    SELECT n.id, n.user_id, ${NOTE_KIND.WRITTEN}::note_kind, '[]'::jsonb,
      ${start.title ?? null}::text, ${start.body ?? ''}::text
    FROM notebooks n
    WHERE n.id = ${notebookId} AND n.user_id = ${userId}
    RETURNING id, kind, title, message_id, statements, body, created_at`);
  const row = result.rows[0];
  return row ? fromRaw(row) : null;
}

export async function listNotes(db: Database, userId: string, notebookId: string): Promise<Note[]> {
  if (!UUID.test(notebookId)) return [];
  const rows = await db
    .select(noteColumns)
    .from(notes)
    .where(and(eq(notes.notebookId, notebookId), eq(notes.userId, userId)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
  return rows.map(toNote);
}

/**
 * Changes the title (any note) or the text (a written note only, a saved answer keeps what it
 * cites). Null when there is no such note of this user, or the text of a saved answer was asked for.
 */
export async function updateNote(
  db: Database,
  userId: string,
  notebookId: string,
  noteId: string,
  changes: NoteUpdateBody
): Promise<Note | null> {
  if (!UUID.test(notebookId) || !UUID.test(noteId)) return null;
  const set: Partial<typeof notes.$inferInsert> = {};
  if (changes.title !== undefined) set.title = changes.title;
  if (changes.body !== undefined) set.body = changes.body;
  const [row] = await db
    .update(notes)
    .set(set)
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.notebookId, notebookId),
        eq(notes.userId, userId),
        changes.body === undefined ? undefined : eq(notes.kind, NOTE_KIND.WRITTEN)
      )
    )
    .returning(noteColumns);
  return row ? toNote(row) : null;
}

export async function deleteNote(
  db: Database,
  userId: string,
  notebookId: string,
  noteId: string
): Promise<boolean> {
  if (!UUID.test(notebookId) || !UUID.test(noteId)) return false;
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.notebookId, notebookId), eq(notes.userId, userId)))
    .returning({ id: notes.id });
  return deleted.length === 1;
}
