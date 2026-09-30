import path from 'node:path';

/**
 * The folder of the drizzle migrations. It sits next to `src` in apps/api, and the code runs from
 * two places: `src/db` (tsx, tests) and the single-file bundle in `dist`. Both are looked at.
 */
export function resolveMigrationsFolder(codeDir: string, exists: (dir: string) => boolean): string {
  const candidates = [path.resolve(codeDir, '../../drizzle'), path.resolve(codeDir, '../drizzle')];
  const found = candidates.find(exists);
  if (!found) throw new Error(`No migrations folder found. Looked in: ${candidates.join(', ')}`);
  return found;
}
