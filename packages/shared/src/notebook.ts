import { z } from 'zod';

import { SourceFailureSchema, SourceKindSchema, SourceStatusSchema } from './source';

const MAX_TITLE_CHARS = 200;
const MAX_URL_CHARS = 2048;
const HTTP_URL = /^https?:\/\//i;

/** What happened when content was submitted. The UI tells "already there" from "new". */
export const SUBMIT_ACTION = {
  /** New content, it is being processed. */
  CREATED: 'CREATED',
  /** The user already has this content, nothing was done. */
  REUSED: 'REUSED',
  /** The earlier attempt failed, it is being processed again. */
  RETRY: 'RETRY',
} as const;

export const SubmitActionSchema = z.enum(SUBMIT_ACTION);

export const NotebookSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  /** How many sources the notebook holds, whatever their state. */
  sourceCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const CreateNotebookBodySchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_CHARS),
});

/** A notebook is renamed with a title under the same rules as when it is created. */
export const RenameNotebookBodySchema = CreateNotebookBodySchema;

export const SourceSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: SourceKindSchema,
  status: SourceStatusSchema,
  /** Set when status is FAILED, so the UI can explain why. */
  failure: SourceFailureSchema.nullable(),
  pageCount: z.number().int().nullable(),
  /** Whether the source is selected in this notebook and therefore used for answers. */
  selected: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const UrlSourceBodySchema = z.object({
  url: z.string().trim().max(MAX_URL_CHARS).regex(HTTP_URL).pipe(z.url()),
});

export const SubmitSourceResultSchema = z.object({
  sourceId: z.uuid(),
  action: SubmitActionSchema,
});

export const SetSourceSelectionBodySchema = z.object({ selected: z.boolean() });

export const NotebookListSchema = z.array(NotebookSchema);
export const SourceListSchema = z.array(SourceSummarySchema);

export type SubmitAction = z.infer<typeof SubmitActionSchema>;
export type Notebook = z.infer<typeof NotebookSchema>;
export type SourceSummary = z.infer<typeof SourceSummarySchema>;
export type SubmitSourceResult = z.infer<typeof SubmitSourceResultSchema>;
