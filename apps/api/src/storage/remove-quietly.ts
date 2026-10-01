import { log } from '../logger';
import type { ObjectStore } from './object-store';

/**
 * Removing a file from the store comes after the change in the database has been made. If the store
 * is down by then, the change still stands, so the failure is logged (IDs only) and not thrown. The
 * file stays behind unreferenced. This is the one deliberate exception to "no silent catch": a
 * request that has already succeeded in the database must not turn into a 500.
 */
export async function removeObjectQuietly(store: ObjectStore, key: string): Promise<void> {
  try {
    await store.remove(key);
  } catch (error) {
    log({ level: 'warn', msg: 'object not removed', key, name: errorName(error) });
  }
}

export async function removePrefixQuietly(store: ObjectStore, prefix: string): Promise<void> {
  try {
    await store.removePrefix(prefix);
  } catch (error) {
    log({ level: 'warn', msg: 'objects not removed', prefix, name: errorName(error) });
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
