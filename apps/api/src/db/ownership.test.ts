import { and, eq, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { ownedNotebook, ownedNotebookSource } from './ownership';
import { notebooks, notebookSources, sources } from './schema';

const render = (predicate: SQL | undefined) => {
  if (!predicate) throw new Error('no predicate');
  return new PgDialect().sqlToQuery(predicate);
};

describe('ownedNotebook', () => {
  it('filters by notebook id and owner in SQL', () => {
    expect(render(ownedNotebook('nb-1', 'user-1'))).toEqual(
      render(and(eq(notebooks.id, 'nb-1'), eq(notebooks.userId, 'user-1')))
    );
  });
});

describe('ownedNotebookSource', () => {
  it('requires the link to the notebook and both owners', () => {
    expect(render(ownedNotebookSource('nb-1', 'user-1'))).toEqual(
      render(
        and(
          eq(notebookSources.notebookId, 'nb-1'),
          eq(notebooks.userId, 'user-1'),
          eq(sources.userId, 'user-1')
        )
      )
    );
  });
});
