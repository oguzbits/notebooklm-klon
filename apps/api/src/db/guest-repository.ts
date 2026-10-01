import { SOURCE_STATUS } from '@nlm/shared';
import { and, asc, count, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

import { notebookOverviewKey } from '../core/notebook-overview-prompt';
import { user } from './auth-schema';
import type { Database } from './client';
import { notebooks, notebookSources, sources } from './schema';

/** The example notebook that guests get a copy of, and whose it is. */
export interface DemoTemplate {
  userId: string;
  notebookId: string;
}

/** The example notebook of the demo owner, or null while there is none (the seed did not run). */
export async function findDemoTemplate(
  db: Database,
  ownerEmail: string,
  title: string
): Promise<DemoTemplate | null> {
  const [found] = await db
    .select({ userId: user.id, notebookId: notebooks.id })
    .from(user)
    .innerJoin(notebooks, eq(notebooks.userId, user.id))
    .where(and(eq(user.email, ownerEmail), eq(notebooks.title, title)))
    .orderBy(asc(notebooks.createdAt))
    .limit(1);
  return found ?? null;
}

/**
 * Copies the example notebook to the guest: the notebook, its ready sources with their text and
 * overview, and every passage with its vector. Nothing is read or embedded again, so a guest costs
 * no provider quota. The copy is the guest's own: other IDs, `userId` of the guest, and the stored
 * overview is kept with the key of the new set of sources. Returns the ID of the new notebook.
 */
export async function copyNotebookToUser(
  db: Database,
  template: DemoTemplate,
  toUserId: string
): Promise<string> {
  return db.transaction(async (tx) => {
    const [original] = await tx
      .select({
        title: notebooks.title,
        chatConfig: notebooks.chatConfig,
        overview: notebooks.overview,
      })
      .from(notebooks)
      .where(and(eq(notebooks.id, template.notebookId), eq(notebooks.userId, template.userId)));
    if (!original) throw new Error('The example notebook does not exist.');

    const [copy] = await tx
      .insert(notebooks)
      .values({ userId: toUserId, title: original.title, chatConfig: original.chatConfig })
      .returning({ id: notebooks.id });
    if (!copy) throw new Error('The copy of the example notebook was not made.');

    const originals = await tx
      .select({ source: sources, selected: notebookSources.selected })
      .from(notebookSources)
      .innerJoin(sources, eq(sources.id, notebookSources.sourceId))
      .where(
        and(
          eq(notebookSources.notebookId, template.notebookId),
          eq(sources.userId, template.userId),
          eq(sources.status, SOURCE_STATUS.READY),
          isNotNull(sources.canonicalText)
        )
      )
      .orderBy(asc(notebookSources.addedAt), asc(sources.id));

    const copiedIds: string[] = [];
    for (const { source, selected } of originals) {
      const [made] = await tx
        .insert(sources)
        .values({
          userId: toUserId,
          contentHash: source.contentHash,
          kind: source.kind,
          title: source.title,
          sourceUrl: source.sourceUrl,
          status: source.status,
          canonicalText: source.canonicalText,
          pageCount: source.pageCount,
          overview: source.overview,
        })
        .returning({ id: sources.id });
      if (!made) throw new Error('A source of the example notebook was not copied.');
      await tx.insert(notebookSources).values({ notebookId: copy.id, sourceId: made.id, selected });
      // The search vector is generated from the text, so it is not copied.
      await tx.execute(sql`
        INSERT INTO chunks (source_id, ordinal, text, start_offset, end_offset, token_count, embedding)
        SELECT ${made.id}, ordinal, text, start_offset, end_offset, token_count, embedding
        FROM chunks WHERE source_id = ${source.id}
      `);
      copiedIds.push(made.id);
    }

    if (original.overview !== null) {
      await tx
        .update(notebooks)
        .set({ overview: original.overview, overviewKey: notebookOverviewKey(copiedIds) })
        .where(eq(notebooks.id, copy.id));
    }
    return copy.id;
  });
}

/** How many guests exist, or how many were started since the given moment. */
export async function countGuests(db: Database, since?: Date): Promise<number> {
  const [row] = await db
    .select({ guests: count() })
    .from(user)
    .where(
      since === undefined
        ? eq(user.isAnonymous, true)
        : and(eq(user.isAnonymous, true), gte(user.createdAt, since))
    );
  return row?.guests ?? 0;
}

/** Deletes guests started before the given moment. Their notebooks, sources and sessions go with them. */
export async function deleteExpiredGuests(db: Database, before: Date): Promise<number> {
  const deleted = await db
    .delete(user)
    .where(and(eq(user.isAnonymous, true), lt(user.createdAt, before)))
    .returning({ id: user.id });
  return deleted.length;
}
