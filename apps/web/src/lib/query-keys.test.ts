import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/lib/query-keys';

describe('queryKeys', () => {
  it('has a prefix that every overview of a notebook starts with, whatever its sources', () => {
    const prefix = queryKeys.notebookOverviews('n1');

    expect(queryKeys.notebookOverview('n1', 'a,b').slice(0, prefix.length)).toEqual(prefix);
    expect(queryKeys.notebookOverview('n1', 'c').slice(0, prefix.length)).toEqual(prefix);
    expect(queryKeys.notebookOverview('n2', 'a,b').slice(0, prefix.length)).not.toEqual(prefix);
  });
});
