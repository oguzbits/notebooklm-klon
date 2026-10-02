import { type ChatConfig, ChatConfigSchema, DEFAULT_CHAT_CONFIG } from '@nlm/shared';

import type { Database } from './client';
import { ownedNotebook } from './ownership';
import { notebooks } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How the assistant talks in a notebook. Null when the notebook is not the user's. */
export async function getChatConfig(
  db: Database,
  userId: string,
  notebookId: string
): Promise<ChatConfig | null> {
  if (!UUID.test(notebookId)) return null;
  const [row] = await db
    .select({ chatConfig: notebooks.chatConfig })
    .from(notebooks)
    .where(ownedNotebook(notebookId, userId));
  if (!row) return null;
  // A stored value that does not fit the contract is a bug, not a case to skip: parse throws.
  return row.chatConfig === null ? DEFAULT_CHAT_CONFIG : ChatConfigSchema.parse(row.chatConfig);
}

export async function setChatConfig(
  db: Database,
  userId: string,
  notebookId: string,
  config: ChatConfig
): Promise<ChatConfig | null> {
  if (!UUID.test(notebookId)) return null;
  const updated = await db
    .update(notebooks)
    .set({ chatConfig: config })
    .where(ownedNotebook(notebookId, userId))
    .returning({ id: notebooks.id });
  return updated.length === 1 ? config : null;
}
