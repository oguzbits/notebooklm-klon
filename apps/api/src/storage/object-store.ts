/** A stored file with the type it was stored with. */
export interface StoredObject {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Where uploaded files that are no sources live (the cover images). The app only needs these four
 * things, so any S3-compatible service can stand behind it, and tests use a fake in memory.
 */
export interface ObjectStore {
  put: (key: string, object: StoredObject) => Promise<void>;
  /** Null when there is no object under the key. */
  get: (key: string) => Promise<StoredObject | null>;
  remove: (key: string) => Promise<void>;
  /** Removes everything under a prefix, for the files of a user who goes away. */
  removePrefix: (prefix: string) => Promise<void>;
}
