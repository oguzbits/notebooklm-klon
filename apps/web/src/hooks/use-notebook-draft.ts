import { type Notebook, type UpdateNotebookBody } from '@nlm/shared';
import { useState } from 'react';

/**
 * What the reader is changing in "Notebook anpassen": the title and the own summary, as typed.
 * `changes` is only what really differs from the notebook (or null when nothing does) and is what
 * gets sent; `valid` says whether the draft may be sent at all.
 */
export function useNotebookDraft(notebook: Notebook) {
  const [title, setTitle] = useState(notebook.title);
  const [writing, setWriting] = useState(notebook.customSummary !== null);
  const [summary, setSummary] = useState(notebook.customSummary ?? '');

  const cleanTitle = title.trim();
  const cleanSummary = writing ? summary.trim() : null;
  const titleChanged = cleanTitle !== notebook.title;
  const summaryChanged = cleanSummary !== notebook.customSummary;
  const changes: UpdateNotebookBody | null =
    titleChanged || summaryChanged
      ? {
          ...(titleChanged && { title: cleanTitle }),
          ...(summaryChanged && { customSummary: cleanSummary }),
        }
      : null;

  return {
    title,
    setTitle,
    writing,
    setWriting,
    summary,
    setSummary,
    valid: cleanTitle !== '' && (!writing || cleanSummary !== ''),
    changes,
  };
}
