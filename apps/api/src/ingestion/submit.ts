import { SOURCE_FAILURE, type SourceKind, SUBMIT_ACTION, type SubmitAction } from '@nlm/shared';
import { z } from 'zod';

import { errorName } from '../logger';
import {
  IngestError,
  type IngestPorts,
  type IngestStage,
  processSource,
  type RegisterInput,
  registerSource,
} from './ingest';

export interface SubmitPorts extends IngestPorts {
  /** The raw bytes of an upload, kept until its source is ready, so a failed source can be read again. */
  uploads: {
    put: (sourceId: string, bytes: Uint8Array) => Promise<void>;
    load: (
      sourceId: string
    ) => Promise<{ kind: SourceKind; bytes: Uint8Array; userId: string } | null>;
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
): Promise<{ sourceId: string; action: SubmitAction }> {
  const registered = await registerSource(input, ports);
  if (registered.action === SUBMIT_ACTION.REUSED) return registered;

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
 * What a failed job tells the logs: IDs, the size, the step and the name of the error. Never the
 * message, which could quote the document. Fields are missing when the job broke before they were known.
 */
export interface JobFailure {
  sourceId?: string;
  userId?: string;
  kind?: SourceKind;
  bytes?: number;
  stage?: IngestStage;
  errorName: string;
  code?: string;
}

/**
 * The work behind one queued job. The upload is deleted only once the source is ready: after a
 * failure the bytes stay, so the source can be read again without uploading it a second time.
 * A failure is reported to `onFailure`, with the error itself for the error tracking (never for a log:
 * its message could quote the document), and then thrown.
 */
export async function runIngestJob(
  payload: unknown,
  ports: SubmitPorts,
  onFailure?: (failure: JobFailure, error: unknown) => void
): Promise<void> {
  const known: Omit<JobFailure, 'errorName'> = {};
  try {
    const { sourceId } = JobPayloadSchema.parse(payload);
    known.sourceId = sourceId;
    const upload = await ports.uploads.load(sourceId);
    if (!upload) throw new Error(`No upload stored for source ${sourceId}.`);
    Object.assign(known, { userId: upload.userId, kind: upload.kind, bytes: upload.bytes.length });
    await processSource({ sourceId, kind: upload.kind, bytes: upload.bytes }, ports);
    await ports.uploads.remove(sourceId);
  } catch (error) {
    const ingest = error instanceof IngestError ? error : null;
    onFailure?.(
      { ...known, stage: ingest?.stage, code: ingest?.code, errorName: errorName(error) },
      error
    );
    throw error;
  }
}

/** Queues a source whose status is already PENDING again. The kept upload stays if that fails. */
export async function restartSource(sourceId: string, ports: SubmitPorts): Promise<void> {
  try {
    await ports.queue.enqueue(sourceId);
  } catch (error) {
    await ports.sources.markFailed(sourceId, SOURCE_FAILURE.ENQUEUE_FAILED);
    throw error;
  }
}
