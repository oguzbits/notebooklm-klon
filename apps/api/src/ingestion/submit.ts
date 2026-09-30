import { SOURCE_FAILURE, type SourceKind } from '@nlm/shared';
import { z } from 'zod';

import {
  type IngestPorts,
  processSource,
  REGISTER_ACTION,
  type RegisterAction,
  type RegisterInput,
  registerSource,
} from './ingest';

export interface SubmitPorts extends IngestPorts {
  /** The raw bytes of an upload, kept only until its job has run. */
  uploads: {
    put: (sourceId: string, bytes: Uint8Array) => Promise<void>;
    load: (sourceId: string) => Promise<{ kind: SourceKind; bytes: Uint8Array } | null>;
    remove: (sourceId: string) => Promise<void>;
  };
  queue: { enqueue: (sourceId: string) => Promise<void> };
}

const JobPayloadSchema = z.object({ sourceId: z.string().min(1) });

/**
 * Registers the content and, if it is new or failed before, hands it to the job queue. Content the
 * user already has is left alone: it is never parsed or embedded twice.
 */
export async function submitSource(
  input: RegisterInput,
  ports: SubmitPorts
): Promise<{ sourceId: string; action: RegisterAction }> {
  const registered = await registerSource(input, ports);
  if (registered.action === REGISTER_ACTION.REUSED) return registered;

  await ports.uploads.put(registered.sourceId, input.bytes);
  try {
    await ports.queue.enqueue(registered.sourceId);
  } catch (error) {
    // Without this the source would stay PENDING forever and re-uploading would count as a duplicate.
    await ports.uploads.remove(registered.sourceId);
    await ports.sources.markFailed(registered.sourceId, SOURCE_FAILURE.ENQUEUE_FAILED);
    throw error;
  }
  return registered;
}

/**
 * The work behind one queued job. The upload is deleted whether processing worked or not: failed
 * sources are retried by uploading again, so the bytes are never kept longer than needed.
 */
export async function runIngestJob(payload: unknown, ports: SubmitPorts): Promise<void> {
  const { sourceId } = JobPayloadSchema.parse(payload);
  const upload = await ports.uploads.load(sourceId);
  if (!upload) throw new Error(`No upload stored for source ${sourceId}.`);
  try {
    await processSource({ sourceId, kind: upload.kind, bytes: upload.bytes }, ports);
  } finally {
    await ports.uploads.remove(sourceId);
  }
}
