import { SOURCE_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { source } from '@/test/fixtures';

import { sortSources, SOURCE_SORT } from './sort-sources';

const a = source({
  id: 'a',
  title: 'beta.pdf',
  kind: SOURCE_KIND.PDF,
  createdAt: '2026-09-01T10:00:00.000Z',
});
const b = source({
  id: 'b',
  title: 'Äpfel',
  kind: SOURCE_KIND.URL,
  createdAt: '2026-09-03T10:00:00.000Z',
});
const c = source({
  id: 'c',
  title: 'alpha.txt',
  kind: SOURCE_KIND.TXT,
  createdAt: '2026-09-02T10:00:00.000Z',
});
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe('sortSources', () => {
  it('keeps the order of the list as it came while nothing is chosen', () => {
    expect(ids(sortSources([a, b, c], SOURCE_SORT.ADDED))).toEqual(['a', 'b', 'c']);
  });

  it('puts the source that was added last first', () => {
    expect(ids(sortSources([a, b, c], SOURCE_SORT.LATEST))).toEqual(['b', 'c', 'a']);
  });

  it('sorts by title the way German readers expect, without regard to case or umlauts first', () => {
    expect(ids(sortSources([a, b, c], SOURCE_SORT.TITLE))).toEqual(['c', 'b', 'a']);
  });

  it('groups by type and keeps the title order inside a type', () => {
    const d = source({ id: 'd', title: 'aaa.pdf', kind: SOURCE_KIND.PDF });
    expect(ids(sortSources([a, b, c, d], SOURCE_SORT.TYPE))).toEqual(['d', 'a', 'c', 'b']);
  });

  it('does not change the list it was given', () => {
    const list = [a, b, c];
    sortSources(list, SOURCE_SORT.TITLE);
    expect(ids(list)).toEqual(['a', 'b', 'c']);
  });
});
