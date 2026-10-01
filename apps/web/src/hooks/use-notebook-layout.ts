import { useCallback, useState } from 'react';

import { COLUMN, type Column } from '@/lib/columns';
import type { ReaderTarget } from '@/lib/reader-target';

/** A question that came from the Studio ("Erklären" on a card); the chat asks it once. */
export interface AskedQuestion {
  id: number;
  question: string;
}

/**
 * What the three columns of a notebook are doing: which column shows below the wide layout, whether
 * the sources and the Studio are folded, what the reader shows, and the question the Studio handed
 * to the chat. The columns are memoized, so folding one (or opening something in the Studio) does not
 * render the others again; for that the functions here keep their identity.
 */
export function useNotebookLayout() {
  const [reading, setReading] = useState<ReaderTarget | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [studioOpen, setStudioOpen] = useState(true);
  const [column, setColumn] = useState<Column>(COLUMN.CHAT);
  const [viewingOutput, setViewingOutput] = useState(false);
  const [asked, setAsked] = useState<AskedQuestion | null>(null);

  const openReader = useCallback((target: ReaderTarget) => {
    setReading(target);
    setSourcesOpen(true);
    setColumn(COLUMN.SOURCES);
  }, []);
  const openSource = useCallback((sourceId: string) => openReader({ sourceId }), [openReader]);
  const openCitation = useCallback((chunkId: string) => openReader({ chunkId }), [openReader]);
  const askInChat = useCallback((question: string) => {
    setAsked((current) => ({ id: (current?.id ?? 0) + 1, question }));
    setColumn(COLUMN.CHAT);
  }, []);
  const expandStudio = useCallback(() => setStudioOpen(true), []);
  const toggleStudio = useCallback(() => setStudioOpen((value) => !value), []);
  const toggleSources = useCallback(() => setSourcesOpen((value) => !value), []);
  const closeReader = useCallback(() => setReading(null), []);

  return {
    reading,
    sourcesOpen,
    studioOpen,
    column,
    setColumn,
    viewingOutput,
    setViewingOutput,
    asked,
    openSource,
    openCitation,
    askInChat,
    expandStudio,
    toggleStudio,
    toggleSources,
    closeReader,
  };
}
