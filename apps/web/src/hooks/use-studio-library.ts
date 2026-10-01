import { useMemo } from 'react';

import { useNotes } from '@/hooks/use-notes';
import { useStudioOutputs } from '@/hooks/use-studio';
import { libraryEntries } from '@/lib/library-entries';

/** The outputs and the notes of a notebook as the one list the Studio shows. */
export function useStudioLibrary(notebookId: string) {
  const outputs = useStudioOutputs(notebookId);
  const notes = useNotes(notebookId);
  const entries = useMemo(
    () => libraryEntries(outputs.data ?? [], notes.data ?? []),
    [outputs.data, notes.data]
  );
  return { outputs, notes, entries };
}
