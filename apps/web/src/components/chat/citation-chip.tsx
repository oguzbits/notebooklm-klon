import { useState } from 'react';

import { Button } from '@/components/ui/button';
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
          className="mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-full bg-accent px-1.5 align-middle text-xs font-medium text-accent-foreground hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {number}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 max-w-[90vw]">
        {chunk.isPending && (
          <div className="flex flex-col gap-2" role="status" aria-label="Wird geladen">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {chunk.isError && (
          <p className="text-sm text-muted-foreground">
            Diese Quelle ist nicht mehr in deinem Notizbuch.
          </p>
        )}
        {chunk.data && (
          <div className="flex flex-col gap-2">
            <p className="truncate text-sm font-medium">{chunk.data.sourceTitle}</p>
            <ScrollArea className="h-40 rounded-md border bg-muted/40 p-2">
              <p className="text-sm whitespace-pre-wrap">{chunk.data.text}</p>
            </ScrollArea>
            <Button
              variant="link"
              size="sm"
              className="self-start px-0"
              onClick={() => onOpen(chunkId)}
            >
              Quelle anzeigen
            </Button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
