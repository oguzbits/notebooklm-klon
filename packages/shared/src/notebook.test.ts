import { describe, expect, it } from 'vitest';

import {
  CreateNotebookBodySchema,
  NotebookSchema,
  RenameSourceBodySchema,
  UpdateNotebookBodySchema,
  UrlSourceBodySchema,
} from './index';

const ID = '3f2b1c9e-8a4d-4f6e-9c1a-2b7d5e8f0a11';
const DATE = '2026-09-30T12:00:00.000Z';

describe('notebook contracts', () => {
  it('carries the symbol of its overview, or null while there is none', () => {
    const base = {
      id: ID,
      title: 'Recherche',
      customSummary: null,
      pinned: false,
      coverVersion: null,
      sourceCount: 1,
      createdAt: DATE,
    };

    expect(NotebookSchema.parse({ ...base, emoji: '🔬' }).emoji).toBe('🔬');
    expect(NotebookSchema.parse({ ...base, emoji: null }).emoji).toBeNull();
    expect(NotebookSchema.safeParse(base).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...base, emoji: 'Text' }).success).toBe(false);
  });

  it('needs a source count that is a whole number of zero or more', () => {
    const base = {
      id: ID,
      title: 'Recherche',
      emoji: null,
      customSummary: null,
      pinned: false,
      coverVersion: null,
      createdAt: DATE,
    };

    expect(NotebookSchema.safeParse(base).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...base, sourceCount: -1 }).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...base, sourceCount: 1.5 }).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...base, sourceCount: 0 }).success).toBe(true);
  });

  it('trims the title of a new notebook and rejects an empty or very long one', () => {
    expect(CreateNotebookBodySchema.parse({ title: '  Idee  ' })).toEqual({ title: 'Idee' });
    expect(CreateNotebookBodySchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(CreateNotebookBodySchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('updates the title, the own summary or both, and needs at least one of them', () => {
    expect(UpdateNotebookBodySchema.parse({ title: ' Neu ' })).toEqual({ title: 'Neu' });
    expect(UpdateNotebookBodySchema.safeParse({ title: '' }).success).toBe(false);
    expect(UpdateNotebookBodySchema.parse({ customSummary: ' Mein Text ' })).toEqual({
      customSummary: 'Mein Text',
    });
    // null takes the own summary back
    expect(UpdateNotebookBodySchema.parse({ customSummary: null })).toEqual({
      customSummary: null,
    });
    expect(UpdateNotebookBodySchema.safeParse({ customSummary: '  ' }).success).toBe(false);
    expect(UpdateNotebookBodySchema.parse({ pinned: true })).toEqual({ pinned: true });
    expect(UpdateNotebookBodySchema.parse({ pinned: false })).toEqual({ pinned: false });
    expect(UpdateNotebookBodySchema.safeParse({}).success).toBe(false);
  });

  it('renames a source with a trimmed, non-empty title', () => {
    expect(RenameSourceBodySchema.parse({ title: ' Bericht 2026 ' })).toEqual({
      title: 'Bericht 2026',
    });
    expect(RenameSourceBodySchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(RenameSourceBodySchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('accepts only an http or https URL for a URL source', () => {
    expect(UrlSourceBodySchema.safeParse({ url: 'https://example.com/a' }).success).toBe(true);
    expect(UrlSourceBodySchema.safeParse({ url: 'ftp://example.com' }).success).toBe(false);
    expect(UrlSourceBodySchema.safeParse({ url: 'kein url' }).success).toBe(false);
  });
});
