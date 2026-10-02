import { z } from 'zod';

export const SOURCE_KIND = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  TXT: 'TXT',
  MD: 'MD',
  URL: 'URL',
  IMAGE: 'IMAGE',
} as const;

export const SOURCE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

/** Why a source ended in FAILED. The UI maps each code to a German message. */
export const SOURCE_FAILURE = {
  EMPTY_TEXT: 'EMPTY_TEXT',
  PARSE_FAILED: 'PARSE_FAILED',
  EMBED_FAILED: 'EMBED_FAILED',
  ENQUEUE_FAILED: 'ENQUEUE_FAILED',
  INTERRUPTED: 'INTERRUPTED',
} as const;

export const SourceKindSchema = z.enum(SOURCE_KIND);
export const SourceStatusSchema = z.enum(SOURCE_STATUS);

export const SourceFailureSchema = z.enum(SOURCE_FAILURE);

export type SourceKind = z.infer<typeof SourceKindSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type SourceFailure = z.infer<typeof SourceFailureSchema>;

/** Vector size of the chosen embedding models. Changing it needs a migration and a re-embed. */
export const EMBEDDING_DIMENSIONS = 768;
