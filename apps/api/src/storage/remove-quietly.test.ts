import { describe, expect, it } from 'vitest';

import { createMemoryObjectStore } from './memory-object-store';
import type { ObjectStore } from './object-store';
import { removeObjectQuietly, removePrefixQuietly } from './remove-quietly';

const broken: ObjectStore = {
  ...createMemoryObjectStore(),
  remove: async () => {
    throw new Error('store down');
  },
  removePrefix: async () => {
    throw new Error('store down');
  },
};

describe('removing files from the store, best effort', () => {
  it('removes what is there', async () => {
    const store = createMemoryObjectStore();
    await store.put('covers/u/n/v', { bytes: new Uint8Array([1]), contentType: 'image/png' });
    await store.put('covers/u/m/v', { bytes: new Uint8Array([1]), contentType: 'image/png' });

    await removeObjectQuietly(store, 'covers/u/n/v');
    expect(store.keys()).toEqual(['covers/u/m/v']);
    await removePrefixQuietly(store, 'covers/u/');
    expect(store.keys()).toEqual([]);
  });

  it('does not throw when the store is down, so a finished change stays a success', async () => {
    await expect(removeObjectQuietly(broken, 'covers/u/n/v')).resolves.toBeUndefined();
    await expect(removePrefixQuietly(broken, 'covers/u/')).resolves.toBeUndefined();
  });
});
