import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { notebook } from '@/test/fixtures';

import { useNotebookDraft } from './use-notebook-draft';

describe('useNotebookDraft', () => {
  it('has no changes and is valid as long as nothing was touched', () => {
    const { result } = renderHook(() => useNotebookDraft(notebook({ title: 'Recherche' })));

    expect(result.current.changes).toBeNull();
    expect(result.current.valid).toBe(true);
  });

  it('sends only what differs: a new title, a new own summary, or taking it back', () => {
    const { result } = renderHook(() => useNotebookDraft(notebook({ title: 'Recherche' })));

    act(() => result.current.setTitle('  Neu  '));
    expect(result.current.changes).toEqual({ title: 'Neu' });

    act(() => {
      result.current.setWriting(true);
      result.current.setSummary('Mein Text');
    });
    expect(result.current.changes).toEqual({ title: 'Neu', customSummary: 'Mein Text' });
  });

  it('is not valid with an empty title or an own summary without text', () => {
    const { result } = renderHook(() => useNotebookDraft(notebook({ title: 'Recherche' })));

    act(() => result.current.setTitle('   '));
    expect(result.current.valid).toBe(false);

    act(() => {
      result.current.setTitle('Recherche');
      result.current.setWriting(true);
    });
    expect(result.current.valid).toBe(false);
  });
});
