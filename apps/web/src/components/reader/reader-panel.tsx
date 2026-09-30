import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { ErrorNotice, ListSkeleton } from '@/components/query-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useChunk, useSourceText } from '@/hooks/use-reader';
import { splitAtHighlight } from '@/lib/citations';

/** What the reader shows: a whole source, or a source with one cited passage marked. */
export type ReaderTarget = { sourceId: string } | { chunkId: string };

export function ReaderPanel({
  notebookId,
  target,
  onClose,
}: {
  notebookId: string;
  target: ReaderTarget;
  onClose: () => void;
}) {
  const chunk = useChunk(
    notebookId,
    'chunkId' in target ? target.chunkId : '',
    'chunkId' in target
  );
  const sourceId = 'sourceId' in target ? target.sourceId : (chunk.data?.sourceId ?? null);
  const source = useSourceText(notebookId, sourceId);
  const mark = useRef<HTMLElement>(null);

  const passage = 'chunkId' in target ? chunk.data : undefined;
  useEffect(() => {
    mark.current?.scrollIntoView?.({ block: 'center' });
  }, [source.data?.id, passage?.id]);

  const parts = splitAtHighlight(
    source.data?.text ?? '',
    passage?.startOffset ?? null,
    passage?.endOffset ?? null
  );
  const failed = chunk.isError || source.isError;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 pb-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft />
          Zurück zu den Quellen
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-2 pr-1">
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
        {!failed && !source.data && <ListSkeleton rows={5} />}
        {source.data && (
          <article className="flex flex-col gap-3">
            <header>
              <h3 className="text-[1.375rem] leading-9">{source.data.title}</h3>
              {source.data.sourceUrl && (
                <a
                  href={source.data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-small text-link underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-3" aria-hidden />
                  Originalseite öffnen
                </a>
              )}
            </header>
            <p className="text-read whitespace-pre-wrap">
              {parts.before}
              {parts.highlight && (
                <mark
                  ref={mark}
                  className="rounded-sm bg-highlight px-0.5 text-highlight-foreground"
                >
                  {parts.highlight}
                </mark>
              )}
              {parts.after}
            </p>
          </article>
        )}
      </div>
    </div>
  );
}
