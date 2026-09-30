import { ChevronUp, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { ErrorNotice } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverview } from '@/hooks/use-overview';

/**
 * The card on top of the reader: a summary of the source and its key topics, made on first view.
 * It folds away with the arrow, like in NotebookLM.
 */
export function SourceOverviewCard({
  notebookId,
  sourceId,
}: {
  notebookId: string;
  sourceId: string;
}) {
  const overview = useOverview(notebookId, sourceId, true);
  const [open, setOpen] = useState(true);
  const toggleLabel = `Quellenübersicht ${open ? 'schließen' : 'öffnen'}`;

  return (
    <section
      aria-label="Quellenübersicht"
      className="max-h-[24.6rem] shrink-0 overflow-y-auto rounded-lg bg-source-guide px-4 pb-4"
    >
      <div className="flex h-10 items-center justify-between">
        <h3 className="flex items-center gap-3 text-[1rem] leading-8 font-[500]">
          <Sparkles className="size-5" aria-hidden />
          Quellenübersicht
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={toggleLabel}
          aria-expanded={open}
          tooltip={toggleLabel}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronUp className={open ? '' : 'rotate-180'} />
        </Button>
      </div>
      {open && (
        <>
          {overview.isPending && (
            <div className="flex flex-col gap-2" role="status" aria-label="Wird geladen">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          {overview.isError && (
            <ErrorNotice
              error={overview.error}
              onRetry={() => void overview.refetch()}
              retrying={overview.isFetching}
            />
          )}
          {overview.data && (
            <div className="flex flex-col gap-4">
              <p className="text-[0.875rem] leading-6">{overview.data.summary}</p>
              {overview.data.keyTopics.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Schlüsselthemen">
                  {overview.data.keyTopics.map((topic) => (
                    <li
                      key={topic}
                      className="h-9 max-w-[10.5rem] truncate rounded-full border border-border px-3 text-ui leading-[2.0625rem]"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
