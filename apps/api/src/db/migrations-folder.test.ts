import { describe, expect, it } from 'vitest';

import { resolveMigrationsFolder } from './migrations-folder';

describe('resolveMigrationsFolder', () => {
  it('finds the folder from the source, where the code lives in src/db', () => {
    const folder = resolveMigrationsFolder(
      '/app/apps/api/src/db',
      (dir) => dir === '/app/apps/api/drizzle'
    );

    expect(folder).toBe('/app/apps/api/drizzle');
  });

  it('finds the folder from the bundle, where the code lives in dist', () => {
    const folder = resolveMigrationsFolder(
      '/app/apps/api/dist',
      (dir) => dir === '/app/apps/api/drizzle'
    );

    expect(folder).toBe('/app/apps/api/drizzle');
  });

  it('throws with the places it looked in when there is no folder', () => {
    expect(() => resolveMigrationsFolder('/app/apps/api/dist', () => false)).toThrow(
      /apps\/drizzle.*apps\/api\/drizzle/s
    );
  });
});
