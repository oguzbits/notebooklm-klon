import type { Database } from '../db/client';
import { linkSource } from '../db/notebook-repository';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import type { LocalImportDeps } from './local-import';

/** The real storage and the real providers for `importLocalFiles`, as the scripts use them. */
export function createLocalImportDeps(
  db: Database,
  providers: {
    parse: LocalImportDeps['ports']['parse'];
    embedDocuments: LocalImportDeps['ports']['embed'];
  }
): LocalImportDeps {
  return {
    ports: {
      sources: createSourceStorage(db),
      uploads: createUploadStorage(db),
      parse: providers.parse,
      embed: providers.embedDocuments,
    },
    link: (userId, notebookId, sourceId) => linkSource(db, userId, notebookId, sourceId),
  };
}
