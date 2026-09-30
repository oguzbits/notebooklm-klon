import { z } from 'zod';

export const SOURCE_KIND = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  TXT: 'TXT',
  MD: 'MD',
  URL: 'URL',
} as const;

export const SOURCE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export const SourceKindSchema = z.enum(SOURCE_KIND);
export const SourceStatusSchema = z.enum(SOURCE_STATUS);

export type SourceKind = z.infer<typeof SourceKindSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

/** Vector size of the chosen embedding models. Changing it needs a migration and a re-embed. */
export const EMBEDDING_DIMENSIONS = 768;
