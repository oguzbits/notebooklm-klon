import type { SourceKind } from '@nlm/shared';

import { runIngestJob, type SubmitPorts, submitSource } from './submit';

export interface LocalFile {
  /** Shown as the title of the source, and the key of the result. */
  name: string;
  kind: SourceKind;
  bytes: Uint8Array;
  /** The address of a saved web page, otherwise null. */
  sourceUrl: string | null;
}

export interface LocalImportDeps {
  ports: Omit<SubmitPorts, 'queue' | 'assertCanCreate'>;
  /** Puts a source into a notebook of the user. False when either is not theirs. */
  link: (userId: string, notebookId: string, sourceId: string) => Promise<boolean>;
}

/**
 * Reads files from disk into a notebook, right here and one after the other: no job queue, no
 * upload limit. For the demo seed and the live eval, which run as scripts. The pipeline is the
 * real one, so known content is reused and a file that cannot be read throws.
 */
export async function importLocalFiles(
  input: { userId: string; notebookId: string; files: LocalFile[] },
  deps: LocalImportDeps
): Promise<Map<string, string>> {
  const queued: string[] = [];
  const ports: SubmitPorts = {
    ...deps.ports,
    assertCanCreate: async () => undefined,
    queue: {
      enqueue: async (sourceId) => {
        queued.push(sourceId);
      },
    },
  };

  const sourceIds = new Map<string, string>();
  for (const file of input.files) {
    const { sourceId } = await submitSource(
      {
        userId: input.userId,
        kind: file.kind,
        title: file.name,
        sourceUrl: file.sourceUrl,
        bytes: file.bytes,
      },
      ports
    );
    if (!(await deps.link(input.userId, input.notebookId, sourceId))) {
      throw new Error(`The source "${file.name}" could not be put into the notebook.`);
    }
    sourceIds.set(file.name, sourceId);
  }

  for (const sourceId of queued) await runIngestJob({ sourceId }, ports);
  return sourceIds;
}
