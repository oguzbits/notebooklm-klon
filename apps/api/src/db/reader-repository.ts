import {
  type AnswerStatement,
  type AnswerTrace,
  CHAT_ROLE,
  type ChatMessage,
  ChatMessageSchema,
  type ChunkDetail,
  type SourceText,
} from '@nlm/shared';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';

import type { Database } from './client';
import { chatMessages, chunks, notebooks, notebookSources, sources } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every function below takes the user ID from the session and filters by it in SQL. A source counts
 * as readable only while it is part of the notebook, so removing it also closes its passages.
 */

export async function findChunkDetail(
  db: Database,
  userId: string,
  notebookId: string,
  chunkId: string
): Promise<ChunkDetail | null> {
  if (!UUID.test(notebookId) || !UUID.test(chunkId)) return null;
  const [row] = await db
    .select({
      id: chunks.id,
      sourceId: chunks.sourceId,
      sourceTitle: sources.title,
      sourceKind: sources.kind,
      text: chunks.text,
      startOffset: chunks.startOffset,
      endOffset: chunks.endOffset,
    })
    .from(chunks)
    .innerJoin(sources, eq(sources.id, chunks.sourceId))
    .innerJoin(notebookSources, eq(notebookSources.sourceId, sources.id))
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .where(
      and(
        eq(chunks.id, chunkId),
        eq(notebookSources.notebookId, notebookId),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId)
      )
    );
  return row ?? null;
}

export async function findSourceText(
  db: Database,
  userId: string,
  notebookId: string,
  sourceId: string
): Promise<SourceText | null> {
  if (!UUID.test(notebookId) || !UUID.test(sourceId)) return null;
  const [row] = await db
    .select({
      id: sources.id,
      title: sources.title,
      kind: sources.kind,
      sourceUrl: sources.sourceUrl,
      text: sources.canonicalText,
    })
    .from(sources)
    .innerJoin(notebookSources, eq(notebookSources.sourceId, sources.id))
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .where(
      and(
        eq(sources.id, sourceId),
        eq(notebookSources.notebookId, notebookId),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId),
        isNotNull(sources.canonicalText)
      )
    );
  return row && row.text !== null ? { ...row, text: row.text } : null;
}

export async function listChatMessages(
  db: Database,
  userId: string,
  notebookId: string
): Promise<ChatMessage[]> {
  if (!UUID.test(notebookId)) return [];
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.notebookId, notebookId), eq(chatMessages.userId, userId)))
    .orderBy(asc(chatMessages.seq));
  // A row that does not fit the contract is a bug, not a case to skip: parse throws.
  return rows.map((row) =>
    ChatMessageSchema.parse({
      id: row.id,
      role: row.role,
      text: row.text ?? undefined,
      statements: row.statements ?? undefined,
      followUps: row.followUps ?? undefined,
      trace: row.trace ?? undefined,
      createdAt: row.createdAt.toISOString(),
    })
  );
}

interface NewMessage {
  role: (typeof CHAT_ROLE)[keyof typeof CHAT_ROLE];
  text: string | null;
  statements: AnswerStatement[] | null;
  followUps: string[];
  trace: AnswerTrace | null;
}

/** Inserts only into a notebook of the user; throws when there is none. */
async function saveMessage(
  db: Database,
  userId: string,
  notebookId: string,
  message: NewMessage
): Promise<void> {
  const statements = message.statements === null ? null : JSON.stringify(message.statements);
  const followUps = message.followUps.length === 0 ? null : JSON.stringify(message.followUps);
  const trace = message.trace === null ? null : JSON.stringify(message.trace);
  const result = await db.execute(sql`
    INSERT INTO chat_messages (notebook_id, user_id, role, text, statements, follow_ups, trace)
    SELECT n.id, n.user_id, ${message.role}::chat_role, ${message.text}, ${statements}::jsonb,
      ${followUps}::jsonb, ${trace}::jsonb
    FROM notebooks n
    WHERE n.id = ${notebookId} AND n.user_id = ${userId}
    RETURNING id`);
  if (result.rowCount !== 1) throw new Error('The notebook does not belong to the user.');
}

export const saveUserMessage = (db: Database, userId: string, notebookId: string, text: string) =>
  saveMessage(db, userId, notebookId, {
    role: CHAT_ROLE.USER,
    text,
    statements: null,
    followUps: [],
    trace: null,
  });

export const saveAssistantMessage = (
  db: Database,
  userId: string,
  notebookId: string,
  statements: AnswerStatement[],
  followUps: string[] = [],
  trace: AnswerTrace | null = null
) =>
  saveMessage(db, userId, notebookId, {
    role: CHAT_ROLE.ASSISTANT,
    text: null,
    statements,
    followUps,
    trace,
  });

/** Deletes the whole chat history of a notebook. False when it is not the user's or does not exist. */
export async function clearChatMessages(
  db: Database,
  userId: string,
  notebookId: string
): Promise<boolean> {
  if (!UUID.test(notebookId)) return false;
  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
  if (!notebook) return false;
  await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.notebookId, notebookId), eq(chatMessages.userId, userId)));
  return true;
}
