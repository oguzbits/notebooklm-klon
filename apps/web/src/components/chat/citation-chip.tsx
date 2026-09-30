import { useState } from 'react';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
          className="veil ml-1 inline-flex size-[22px] items-center justify-center rounded-full bg-secondary align-middle text-[0.6875rem] leading-4 font-[500] text-muted-foreground"
        >
          {number}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[420px] max-w-[90vw]">
        {chunk.isPending && (
          <div className="flex flex-col gap-2 p-4" role="status" aria-label="Wird geladen">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {chunk.isError && (
          <p className="p-4 text-[0.875rem] leading-6 text-muted-foreground">
            Diese Quelle ist nicht mehr in deinem Notizbuch.
          </p>
        )}
        {chunk.data && (
          <div className="flex flex-col text-[0.875rem] leading-6">
            <p className="truncate px-4 py-3 font-[500]">{chunk.data.sourceTitle}</p>
            <ScrollArea className="h-64 border-t border-border">
              <p className="p-4 whitespace-pre-wrap">{chunk.data.text}</p>
            </ScrollArea>
            <div className="border-t border-border px-4 py-4">
              <button
                type="button"
                className="rounded-sm text-link hover:underline"
                onClick={() => onOpen(chunkId)}
              >
                Quelle anzeigen
              </button>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
