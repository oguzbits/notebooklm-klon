import { z } from 'zod';

import { CustomSummarySchema, NotebookOverviewSchema } from './overview';
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

/** What a cover image may be: PNG, JPEG or WebP, up to 2 MB. The server checks the bytes, not the name. */
export const COVER_IMAGE = {
  MAX_BYTES: 2 * 1024 * 1024,
  TYPES: ['image/png', 'image/jpeg', 'image/webp'],
} as const;

export const NotebookSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  /** The symbol its overview chose, null until the overview was made. */
  emoji: NotebookOverviewSchema.shape.emoji.nullable(),
  /** The summary the user wrote, shown instead of the model's. Null: the model's summary is shown. */
  customSummary: CustomSummarySchema.nullable(),
  /** Names the cover image so a new one is fetched; null: no cover image. */
  coverVersion: z.uuid().nullable(),
  /** Pinned notebooks stand first on the start page. */
  pinned: z.boolean(),
  /** How many sources the notebook holds, whatever their state. */
  sourceCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const CreateNotebookBodySchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_CHARS),
});

/**
 * What can be changed about a notebook: its title (same rules as when it is created), its own
 * summary (null takes it back) and whether it is pinned. Fields left out stay as they are, and at
 * least one is given.
 */
export const UpdateNotebookBodySchema = z
  .object({
    title: CreateNotebookBodySchema.shape.title.optional(),
    customSummary: CustomSummarySchema.nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Nothing to change.',
  });

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

/** A source is renamed with a title under the same rules as a notebook. */
export const RenameSourceBodySchema = CreateNotebookBodySchema;

export const SetSourceSelectionBodySchema = z.object({ selected: z.boolean() });

export const NotebookListSchema = z.array(NotebookSchema);
export const SourceListSchema = z.array(SourceSummarySchema);

export type SubmitAction = z.infer<typeof SubmitActionSchema>;
export type Notebook = z.infer<typeof NotebookSchema>;
export type UpdateNotebookBody = z.infer<typeof UpdateNotebookBodySchema>;
export type SourceSummary = z.infer<typeof SourceSummarySchema>;
export type SubmitSourceResult = z.infer<typeof SubmitSourceResultSchema>;
