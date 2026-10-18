import {
  CHAT_ROLE,
  NOTE_KIND,
  SOURCE_KIND,
  STUDIO_KIND,
  USAGE_PURPOSE,
  USAGE_ROLE,
} from '@nlm/shared';
import { getTableName, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withUser } from './client';
import {
  chatMessages,
  chunks,
  notebooks,
  notebookSources,
  notes,
  sources,
  sourceUploads,
  studioOutputs,
  usageEvents,
} from './schema';
import { createTestAppDb, createTestDb, ensureUsers } from './testing/test-db';

const owner = createTestDb();
const app = createTestAppDb();
const ALICE = 'rls-alice';
const BOB = 'rls-bob';

/** One of everything for the user, written as the owner (who is exempt from the policies). */
async function seed(userId: string) {
  const [notebook] = await owner.db
    .insert(notebooks)
    .values({ userId, title: `Notizbuch von ${userId}` })
    .returning();
  const [source] = await owner.db
    .insert(sources)
    .values({
      userId,
      contentHash: `hash-${userId}`,
      kind: SOURCE_KIND.PDF,
      title: 'Quelle',
    })
    .returning();
  await owner.db.insert(notebookSources).values({ notebookId: notebook!.id, sourceId: source!.id });
  await owner.db.insert(sourceUploads).values({ sourceId: source!.id, bytes: new Uint8Array([1]) });
  await owner.db
    .insert(chunks)
    .values({ sourceId: source!.id, ordinal: 0, text: 'Text', startOffset: 0, endOffset: 4 });
  await owner.db
    .insert(chatMessages)
    .values({ notebookId: notebook!.id, userId, role: CHAT_ROLE.USER });
  await owner.db.insert(notes).values({
    notebookId: notebook!.id,
    userId,
    kind: NOTE_KIND.ANSWER,
    statements: [],
  });
  await owner.db.insert(studioOutputs).values({
    notebookId: notebook!.id,
    userId,
    kind: STUDIO_KIND.REPORT,
    title: 'Studio',
    content: {},
  });
  await owner.db.insert(usageEvents).values({
    userId,
    purpose: USAGE_PURPOSE.CHAT,
    role: USAGE_ROLE.CHAT,
    inputTokens: 1,
    outputTokens: 1,
    estimated: false,
  });
  return { notebookId: notebook!.id, sourceId: source!.id };
}

const TABLES = [
  notebooks,
  sources,
  sourceUploads,
  notebookSources,
  chunks,
  chatMessages,
  notes,
  studioOutputs,
  usageEvents,
].map((table) => [getTableName(table), table] as const);

let alice: { notebookId: string; sourceId: string };

beforeAll(async () => {
  await owner.pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(owner.pool, [ALICE, BOB]);
  alice = await seed(ALICE);
  await seed(BOB);
});

afterAll(async () => {
  await owner.pool.query('TRUNCATE "user" CASCADE');
  await owner.pool.end();
  await app.pool.end();
});

describe('row-level security for the app role', () => {
  it.each(TABLES)('shows no row of %s without a user', async (_name, table) => {
    expect(await app.db.select().from(table)).toHaveLength(0);
  });

  it.each(TABLES)('shows only the rows of the current user in %s', async (_name, table) => {
    const own = await withUser(app.db, ALICE, (tx) => tx.select().from(table));
    const foreign = await withUser(app.db, 'rls-nobody', (tx) => tx.select().from(table));

    expect(own).toHaveLength(1);
    expect(foreign).toHaveLength(0);
  });

  it('refuses to write a row for another user', async () => {
    await expect(
      withUser(app.db, BOB, (tx) =>
        tx.insert(notebooks).values({ userId: ALICE, title: 'Untergeschoben' })
      )
    ).rejects.toThrow();
  });

  it('refuses to link a notebook of another user to a source', async () => {
    await expect(
      withUser(app.db, BOB, (tx) =>
        tx
          .insert(notebookSources)
          .values({ notebookId: alice.notebookId, sourceId: alice.sourceId })
      )
    ).rejects.toThrow();
  });

  it('keeps the user inside the transaction, so a pooled connection does not carry it over', async () => {
    await withUser(app.db, ALICE, (tx) => tx.select().from(notebooks));

    expect(await app.db.select().from(notebooks)).toHaveLength(0);
    const [setting] = (await app.db.execute(sql`select current_setting('app.user_id', true) as v`))
      .rows;
    expect(setting?.v ?? '').toBe('');
  });

  it('lets the owner see every row, which the system jobs rely on', async () => {
    expect(await owner.db.select().from(notebooks)).toHaveLength(2);
  });
});
