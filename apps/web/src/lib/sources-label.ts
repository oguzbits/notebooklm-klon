import { tr } from './i18n';
/** "1 Quelle", "2 Quellen": how many sources, in words. */
export const sourcesLabel = (count: number) =>
  tr(
    `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`,
    `${count} ${count === 1 ? 'source' : 'sources'}`
  );
