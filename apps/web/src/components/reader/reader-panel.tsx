import { ExternalLink, Minimize2 } from 'lucide-react';

import { ErrorNotice } from '@/components/query-boundary';
import { SourceText } from '@/components/reader/source-text';
import { SourceOverviewCard } from '@/components/sources/source-overview';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChunk, useSourceText } from '@/hooks/use-reader';

/** What the reader shows: a whole source, or a source with one cited passage marked. */
export type ReaderTarget = { sourceId: string } | { chunkId: string };

/** The button in the header of the sources that leaves the reader, like in the original. */
export function CloseReaderButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Quellenansicht schließen"
      tooltip="Quellenansicht schließen"
      onClick={onClick}
    >
      <Minimize2 />
    </Button>
  );
}

export function ReaderPanel({ notebookId, target }: { notebookId: string; target: ReaderTarget }) {
  const chunk = useChunk(
    notebookId,
    'chunkId' in target ? target.chunkId : '',
    'chunkId' in target
  );
  const sourceId = 'sourceId' in target ? target.sourceId : (chunk.data?.sourceId ?? null);
  const source = useSourceText(notebookId, sourceId);
  const passage = 'chunkId' in target ? chunk.data : undefined;
  const highlight = passage ? { start: passage.startOffset, end: passage.endOffset } : null;
  const failed = chunk.isError || source.isError;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {failed && (
        <Alert>
          <AlertDescription>
            {chunk.isError
              ? 'Diese Quelle ist nicht mehr in deinem Notizbuch.'
              : 'Der Text dieser Quelle ist noch nicht verfügbar.'}
            {source.isError && (
              <ErrorNotice
                error={source.error}
                onRetry={() => void source.refetch()}
                retrying={source.isFetching}
              />
            )}
          </AlertDescription>
        </Alert>
      )}
      {!failed && !source.data && (
        <div className="flex flex-col gap-3" role="status" aria-label="Wird geladen">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-6 w-4/5" />
        </div>
      )}
      {source.data && (
        <>
          <header className="flex shrink-0 items-start justify-between gap-2 pb-4">
            <h3 className="min-w-0 text-[1.375rem] leading-9">{source.data.title}</h3>
            {source.data.sourceUrl && (
              <Button variant="ghost" size="icon-sm" tooltip="Extern öffnen" asChild>
                <a
                  href={source.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Originalseite öffnen"
                >
                  <ExternalLink />
                </a>
              </Button>
            )}
          </header>
          <SourceOverviewCard notebookId={notebookId} sourceId={source.data.id} />
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2 pl-0.5">
            <SourceText text={source.data.text} kind={source.data.kind} highlight={highlight} />
          </div>
        </>
      )}
    </div>
  );
}
