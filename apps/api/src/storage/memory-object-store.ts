import type { ObjectStore, StoredObject } from './object-store';

/** An object store in memory, for tests and the offline server. */
export function createMemoryObjectStore(): ObjectStore & { keys: () => string[] } {
  const objects = new Map<string, StoredObject>();
  return {
    put: async (key, object) => {
      objects.set(key, { bytes: new Uint8Array(object.bytes), contentType: object.contentType });
    },
    get: async (key) => objects.get(key) ?? null,
    remove: async (key) => {
      objects.delete(key);
    },
    removePrefix: async (prefix) => {
      for (const key of [...objects.keys()]) if (key.startsWith(prefix)) objects.delete(key);
    },
    keys: () => [...objects.keys()].sort(),
  };
}
