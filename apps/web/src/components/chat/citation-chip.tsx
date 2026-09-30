import { useState } from 'react';

import { SourceText } from '@/components/reader/source-text';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChunk } from '@/hooks/use-reader';

interface CitationChipProps {
  notebookId: string;
  chunkId: string;
  number: number;
  onOpen: (chunkId: string) => void;
}

/**
 * A numbered chip after a statement. Hovering shows the cited passage with its source, clicking
 * (or "Quelle anzeigen") opens the source text with the passage highlighted.
 */
export function CitationChip({ notebookId, chunkId, number, onOpen }: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const chunk = useChunk(notebookId, chunkId, open);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(chunkId)}
          aria-label={`Quelle ${number} anzeigen`}
          className="veil ml-1 inline-flex size-[22px] items-center justify-center rounded-full bg-secondary align-middle text-[0.6875rem] leading-4 font-[500] text-meta"
        >
          {number}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="flex max-h-[420px] w-[420px] max-w-[90vw] flex-col">
        {chunk.isPending && (
          <div className="flex flex-col gap-3 p-4" role="status" aria-label="Wird geladen">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        )}
        {chunk.isError && (
          <p className="p-4 text-[0.875rem] leading-6 text-muted-foreground">
            Diese Quelle ist nicht mehr in deinem Notizbuch.
          </p>
        )}
        {chunk.data && (
          <>
            <p className="shrink-0 truncate px-4 py-3 text-[0.875rem] leading-6 font-[500]">
              {chunk.data.sourceTitle}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
              <SourceText text={chunk.data.text} kind={chunk.data.sourceKind} />
            </div>
            <div className="shrink-0 border-t border-[var(--table-line)] p-4 text-[0.875rem] leading-6">
              <button
                type="button"
                className="rounded-sm text-link hover:underline"
                onClick={() => onOpen(chunkId)}
              >
                Quelle anzeigen
              </button>
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
