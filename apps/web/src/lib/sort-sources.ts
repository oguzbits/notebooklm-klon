import { SOURCE_KIND, type SourceSummary } from '@nlm/shared';

/** How the list of sources is ordered. ADDED is the order the server sends (oldest first). */
export const SOURCE_SORT = {
  ADDED: 'ADDED',
  LATEST: 'LATEST',
  TITLE: 'TITLE',
  TYPE: 'TYPE',
} as const;
export type SourceSort = (typeof SOURCE_SORT)[keyof typeof SOURCE_SORT];

const KIND_ORDER = Object.values(SOURCE_KIND);
const byTitle = (x: SourceSummary, y: SourceSummary) =>
  x.title.localeCompare(y.title, 'de', { sensitivity: 'base' });

/** The sources in the order of the choice, as a new list. */
export function sortSources(list: SourceSummary[], sort: SourceSort): SourceSummary[] {
  const copy = [...list];
  switch (sort) {
    case SOURCE_SORT.LATEST:
      return copy.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    case SOURCE_SORT.TITLE:
      return copy.sort(byTitle);
    case SOURCE_SORT.TYPE:
      return copy.sort(
        (x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || byTitle(x, y)
      );
    default:
      return copy;
  }
}
