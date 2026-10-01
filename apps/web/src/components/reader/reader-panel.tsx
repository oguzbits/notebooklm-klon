import type { SourceText } from '@nlm/shared';
import { ExternalLink, Minimize2 } from 'lucide-react';

import { ErrorNotice } from '@/components/query-boundary';
import { SourceText as SourceTextView } from '@/components/reader/source-text';
import { SourceOverviewCard } from '@/components/sources/source-overview';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useReaderContent } from '@/hooks/use-reader-content';
import type { ReaderTarget } from '@/lib/reader-target';

interface CloseReaderButtonProps {
  onClick: () => void;
}

/** The button in the header of the sources that leaves the reader, like in the original. */
export function CloseReaderButton({ onClick }: CloseReaderButtonProps) {
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

interface ReaderPanelProps {
  notebookId: string;
  target: ReaderTarget;
}

/** Why the reader has nothing to show: the passage is gone, or the text is not there yet (with a retry). */
function ReaderFailure({
  content,
}: {
  content: Pick<ReturnType<typeof useReaderContent>, 'chunk' | 'source'>;
}) {
  const { chunk, source } = content;
  return (
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
  );
}

/** The placeholder in the shape of a source while its text loads. */
function ReaderLoading() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Wird geladen">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-11/12" />
      <Skeleton className="h-6 w-4/5" />
    </div>
  );
}

/** A source: its title with the link to the original, its overview, and its text with the passage marked. */
function ReaderSource({
  notebookId,
  source,
  highlight,
}: {
  notebookId: string;
  source: SourceText;
  highlight: { start: number; end: number } | null;
}) {
  return (
    <>
      <header className="flex shrink-0 items-start justify-between gap-2 pb-4">
        <h3 className="min-w-0 text-[1.375rem] leading-9">{source.title}</h3>
        {source.sourceUrl && (
          <Button variant="ghost" size="icon-sm" tooltip="Extern öffnen" asChild>
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Originalseite öffnen"
            >
              <ExternalLink />
            </a>
          </Button>
        )}
      </header>
      <SourceOverviewCard notebookId={notebookId} sourceId={source.id} />
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2 pl-0.5">
        <SourceTextView text={source.text} kind={source.kind} highlight={highlight} />
      </div>
    </>
  );
}

export function ReaderPanel({ notebookId, target }: ReaderPanelProps) {
  const content = useReaderContent(notebookId, target);
  const { source, highlight, failed } = content;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {failed && <ReaderFailure content={content} />}
      {!failed && !source.data && <ReaderLoading />}
      {source.data && (
        <ReaderSource notebookId={notebookId} source={source.data} highlight={highlight} />
      )}
    </div>
  );
}
