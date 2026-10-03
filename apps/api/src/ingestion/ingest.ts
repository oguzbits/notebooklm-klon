import {
  EMBEDDING_DIMENSIONS,
  SOURCE_FAILURE,
  SOURCE_STATUS,
  type SourceFailure,
  type SourceKind,
  SUBMIT_ACTION,
  type SubmitAction,
} from '@nlm/shared';

import { LIMITS } from '../config/limits';
import { toCanonicalText } from '../core/canonical-text';
import { chunkText, type TextChunk } from '../core/chunking';
import { hashContent } from '../core/content-hash';

export const INGEST_ERROR = {
  EMPTY_TEXT: 'EMPTY_TEXT_ERROR',
  PARSE_FAILED: 'PARSE_FAILED_ERROR',
  EMBED_FAILED: 'EMBED_FAILED_ERROR',
} as const;

export type IngestErrorCode = (typeof INGEST_ERROR)[keyof typeof INGEST_ERROR];

/** Processing failed and the source was marked FAILED. The cause is kept for the logs. */
export class IngestError extends Error {
  constructor(
    readonly code: IngestErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'IngestError';
  }
}

export interface ParsedDocument {
  text: string;
  pageCount: number | null;
}

export interface StoredChunk extends TextChunk {
  embedding: number[];
}

/** Everything the pipeline needs from the outside: storage, parsing and embedding. */
export interface IngestPorts {
  sources: {
    /** Makes the source for this content, or returns the one the user already has (created: false). */
    findOrCreate: (input: {
      userId: string;
      contentHash: string;
      kind: SourceKind;
      title: string;
      sourceUrl: string | null;
    }) => Promise<{ id: string; status: string; created: boolean }>;
    markProcessing: (sourceId: string) => Promise<void>;
    markReady: (
      sourceId: string,
      result: { canonicalText: string; pageCount: number | null; chunks: StoredChunk[] }
    ) => Promise<void>;
    markFailed: (sourceId: string, failure: SourceFailure) => Promise<void>;
  };
  parse: (kind: SourceKind, bytes: Uint8Array) => Promise<ParsedDocument>;
  embed: (texts: string[]) => Promise<number[][]>;
}

export interface RegisterInput {
  userId: string;
  kind: SourceKind;
  title: string;
  sourceUrl: string | null;
  bytes: Uint8Array;
}

/**
 * Identifies the content by its SHA-256 per user. The same content is never stored, parsed or
 * embedded twice: an existing source is reused, only a FAILED one is processed again.
 */
export async function registerSource(
  input: RegisterInput,
  ports: IngestPorts
): Promise<{ sourceId: string; action: SubmitAction }> {
  const source = await ports.sources.findOrCreate({
    userId: input.userId,
    contentHash: hashContent(input.bytes),
    kind: input.kind,
    title: input.title,
    sourceUrl: input.sourceUrl,
  });
  if (source.created) return { sourceId: source.id, action: SUBMIT_ACTION.CREATED };
  const action =
    source.status === SOURCE_STATUS.FAILED ? SUBMIT_ACTION.RETRY : SUBMIT_ACTION.REUSED;
  return { sourceId: source.id, action };
}

/** Why a source could not be made ready: what the UI shows, the code that is thrown, the cause. */
interface Problem {
  failure: SourceFailure;
  code: IngestErrorCode;
  message: string;
  cause?: unknown;
}

async function fail(ports: IngestPorts, sourceId: string, problem: Problem): Promise<never> {
  await ports.sources.markFailed(sourceId, problem.failure);
  throw new IngestError(problem.code, problem.message, problem.cause);
}

async function embedAll(ports: IngestPorts, chunks: TextChunk[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < chunks.length; start += LIMITS.EMBED_BATCH_SIZE) {
    const batch = chunks.slice(start, start + LIMITS.EMBED_BATCH_SIZE);
    const embedded = await ports.embed(batch.map((chunk) => chunk.text));
    if (embedded.length !== batch.length) {
      throw new Error(`expected ${batch.length} embeddings, got ${embedded.length}`);
    }
    for (const vector of embedded) {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
      }
    }
    vectors.push(...embedded);
  }
  return vectors;
}

/**
 * Turns the raw bytes of a registered source into stored, searchable chunks. Any failure marks the
 * source FAILED with a code the UI can explain and is then thrown, so the caller still sees it.
 */
export async function processSource(
  input: { sourceId: string; kind: SourceKind; bytes: Uint8Array },
  ports: IngestPorts
): Promise<void> {
  const { sourceId } = input;
  await ports.sources.markProcessing(sourceId);

  let parsed: ParsedDocument;
  try {
    parsed = await ports.parse(input.kind, input.bytes);
  } catch (error) {
    return fail(ports, sourceId, {
      failure: SOURCE_FAILURE.PARSE_FAILED,
      code: INGEST_ERROR.PARSE_FAILED,
      message: 'The document could not be read.',
      cause: error,
    });
  }

  const canonicalText = toCanonicalText(parsed.text);
  const chunks = chunkText(canonicalText);
  if (chunks.length === 0) {
    return fail(ports, sourceId, {
      failure: SOURCE_FAILURE.EMPTY_TEXT,
      code: INGEST_ERROR.EMPTY_TEXT,
      message: 'The document has no text.',
    });
  }

  let vectors: number[][];
  try {
    vectors = await embedAll(ports, chunks);
  } catch (error) {
    return fail(ports, sourceId, {
      failure: SOURCE_FAILURE.EMBED_FAILED,
      code: INGEST_ERROR.EMBED_FAILED,
      message: 'The text could not be indexed.',
      cause: error,
    });
  }

  await ports.sources.markReady(sourceId, {
    canonicalText,
    pageCount: parsed.pageCount,
    chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] ?? [] })),
  });
}
