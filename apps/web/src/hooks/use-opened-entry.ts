import type { Note, StudioOutput } from '@nlm/shared';
import { useEffect, useState, useTransition } from 'react';

import { ENTRY, type OpenEntry } from '@/lib/library-entries';

/**
 * Which output or note is open in the Studio. The column changes its width when something opens in
 * it, which is told first and at once; the content follows as a transition, so the heavy render of
 * a view does not eat the start of the move.
 */
export function useOpenedEntry(
  outputs: readonly StudioOutput[] | undefined,
  notes: readonly Note[] | undefined,
  onViewingChange?: (viewing: boolean) => void
) {
  const [open, setOpen] = useState<OpenEntry | null>(null);
  const [, startTransition] = useTransition();

  const openedOutput =
    open?.type === ENTRY.OUTPUT ? outputs?.find((output) => output.id === open.id) : undefined;
  const openedNote =
    open?.type === ENTRY.NOTE ? notes?.find((note) => note.id === open.id) : undefined;
  const viewing = openedOutput !== undefined || openedNote !== undefined;
  useEffect(() => {
    onViewingChange?.(viewing);
  }, [viewing, onViewingChange]);

  const show = (entry: OpenEntry | null) => {
    onViewingChange?.(entry !== null);
    startTransition(() => setOpen(entry));
  };

  return { openedOutput, openedNote, show };
}
