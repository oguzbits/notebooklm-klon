import { describe, expect, it } from 'vitest';

import {
  CreateNotebookBodySchema,
  NotebookSchema,
  RenameNotebookBodySchema,
  SetSourceSelectionBodySchema,
  SOURCE_KIND,
  SOURCE_STATUS,
  SourceSummarySchema,
  SUBMIT_ACTION,
  SubmitSourceResultSchema,
  UrlSourceBodySchema,
} from './index';

const ID = '3f2b1c9e-8a4d-4f6e-9c1a-2b7d5e8f0a11';
const DATE = '2026-09-30T12:00:00.000Z';

describe('notebook contracts', () => {
  it('parses a notebook', () => {
    expect(NotebookSchema.parse({ id: ID, title: 'Recherche', createdAt: DATE }).title).toBe(
      'Recherche'
    );
  });

  it('trims the title of a new notebook and rejects an empty or very long one', () => {
    expect(CreateNotebookBodySchema.parse({ title: '  Idee  ' })).toEqual({ title: 'Idee' });
    expect(CreateNotebookBodySchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(CreateNotebookBodySchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
    expect(RenameNotebookBodySchema.parse({ title: ' Neu ' })).toEqual({ title: 'Neu' });
    expect(RenameNotebookBodySchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('parses a source summary with and without a failure', () => {
    const base = {
      id: ID,
      title: 'Bericht.pdf',
      kind: SOURCE_KIND.PDF,
      status: SOURCE_STATUS.READY,
      pageCount: 3,
      selected: true,
      createdAt: DATE,
    };

    expect(SourceSummarySchema.parse({ ...base, failure: null }).failure).toBeNull();
    expect(SourceSummarySchema.safeParse({ ...base, status: 'DONE', failure: null }).success).toBe(
      false
    );
  });

  it('accepts only an http or https URL for a URL source', () => {
    expect(UrlSourceBodySchema.safeParse({ url: 'https://example.com/a' }).success).toBe(true);
    expect(UrlSourceBodySchema.safeParse({ url: 'ftp://example.com' }).success).toBe(false);
    expect(UrlSourceBodySchema.safeParse({ url: 'kein url' }).success).toBe(false);
  });

  it('parses the result of a submission for every action', () => {
    for (const action of Object.values(SUBMIT_ACTION)) {
      expect(SubmitSourceResultSchema.parse({ sourceId: ID, action }).action).toBe(action);
    }
  });

  it('requires a boolean for the selection of a source', () => {
    expect(SetSourceSelectionBodySchema.parse({ selected: false })).toEqual({ selected: false });
    expect(SetSourceSelectionBodySchema.safeParse({ selected: 'yes' }).success).toBe(false);
  });
});
