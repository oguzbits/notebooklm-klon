import { useEffect, useMemo, useState } from 'react';

import { useUpdateNote } from '@/hooks/use-notes';
import { createSaveQueue, type SaveEvent } from '@/lib/save-queue';

/** How long the reader has to stop typing before the text is saved. */
const SAVE_DELAY_MS = 800;

/**
 * Saves the text of a note as it is typed, and what is left of it when the note is closed. The
 * editor owns the text while it is open; the server only gets it.
 */
export function useNoteAutosave(notebookId: string, noteId: string) {
  const { mutateAsync } = useUpdateNote(notebookId);
  // Null until the first save: opening a note is not a change.
  const [event, setEvent] = useState<SaveEvent | null>(null);

  const queue = useMemo(
    () =>
      createSaveQueue({
        delayMs: SAVE_DELAY_MS,
        write: async (body) => {
          await mutateAsync({ noteId, changes: { body } });
        },
        onChange: setEvent,
      }),
    [mutateAsync, noteId]
  );

  useEffect(
    () => () => {
      void queue.flush();
    },
    [queue]
  );

  return { event, push: queue.push, flush: queue.flush };
}
