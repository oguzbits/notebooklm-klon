import { CHAT_ROLE, type Note, NoteSchema } from '@nlm/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Database } from './client';
import { notes } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NoteRow = { id: string; messageId: string | null; statements: unknown; createdAt: Date };

// A stored note that does not fit the contract is a bug, not a case to skip: parse throws.
const toNote = (row: NoteRow): Note =>
  NoteSchema.parse({
    id: row.id,
    messageId: row.messageId,
    statements: row.statements,
    createdAt: row.createdAt.toISOString(),
  });

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
  const result = await db.execute<{
    id: string;
    message_id: string | null;
    statements: unknown;
    // Drizzle's driver hands raw timestamps out as text, not as Date.
    created_at: string;
  }>(sql`
    INSERT INTO notes (notebook_id, user_id, message_id, statements)
    SELECT m.notebook_id, m.user_id, m.id, m.statements
    FROM chat_messages m
    WHERE m.id = ${messageId} AND m.notebook_id = ${notebookId} AND m.user_id = ${userId}
      AND m.role = ${CHAT_ROLE.ASSISTANT}::chat_role
      AND jsonb_array_length(m.statements) > 0
    ON CONFLICT (message_id) DO UPDATE SET message_id = EXCLUDED.message_id
    RETURNING id, message_id, statements, created_at`);
  const row = result.rows[0];
  return row
    ? toNote({
        id: row.id,
        messageId: row.message_id,
        statements: row.statements,
        createdAt: new Date(row.created_at),
      })
    : null;
}

export async function listNotes(db: Database, userId: string, notebookId: string): Promise<Note[]> {
  if (!UUID.test(notebookId)) return [];
  const rows = await db
    .select({
      id: notes.id,
      messageId: notes.messageId,
      statements: notes.statements,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(eq(notes.notebookId, notebookId), eq(notes.userId, userId)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
  return rows.map(toNote);
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
