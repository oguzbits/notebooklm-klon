import type { SourceSummary } from '@nlm/shared';
import { Check, Pin } from 'lucide-react';
import { useState } from 'react';

import { InlineText } from '@/components/chat/inline-text';
import { ErrorNotice } from '@/components/query-boundary';
import { SummarySkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { useNotebookOverview } from '@/hooks/use-notebook-overview';
import { useNotebook } from '@/hooks/use-notebooks';
import { useCreateWrittenNote } from '@/hooks/use-notes';
import { formatDay } from '@/lib/day';
import { describeError } from '@/lib/messages';
import { notebookEmoji } from '@/lib/notebook-emoji';
import { withoutMarkers } from '@/lib/plain-text';
import { sourcesLabel } from '@/lib/sources-label';

const SUMMARY_NOTE_TITLE = 'Zusammenfassung';

/**
 * What the notebook is about, at the top of the chat like in the original: a cover with the symbol
 * the notebook wears, its title and how many sources it holds, then a summary of all its sources
 * with the key terms in bold, and what can be done with it (keep it as a note, copy it). The
 * summary describes the sources and does not answer a question, so it has no citation chips.
 */
export function NotebookOverview({
  notebookId,
  sources,
  onCustomize,
}: {
  notebookId: string;
  sources: SourceSummary[] | undefined;
  onCustomize: () => void;
}) {
  const notebook = useNotebook(notebookId).data;
  const { overview, ready, loading, isError, error, retry, retrying } = useNotebookOverview(
    notebookId,
    sources
  );
  const save = useCreateWrittenNote(notebookId);
  // The summary that was kept as a note; a new summary can be kept again.
  const [kept, setKept] = useState<string | null>(null);

  if (!ready) return null;
  const emoji = overview?.emoji ?? notebook?.emoji ?? notebookEmoji(notebookId);

  return (
    <section aria-labelledby="notebook-overview-title" className="-mt-2">
      {/* 265 high like in the original; on a phone, which was not measured, a good deal shorter. */}
      <header className="relative flex min-h-[200px] flex-col justify-end pb-6 sm:min-h-[265px]">
        <span
          aria-hidden
          className="absolute top-6 left-0 flex size-10 items-center justify-center text-[40px] leading-10"
        >
          {emoji}
        </span>
        {/* Like the original: the whole cover is one invisible control that opens "Notebook anpassen". */}
        <button
          type="button"
          aria-label="Notizbuch anpassen"
          onClick={onCustomize}
          className="absolute inset-0 rounded-3xl"
        />
        {notebook && (
          <>
            <h3
              id="notebook-overview-title"
              className="text-[2.25rem] leading-[2.75rem] font-[320] break-words"
            >
              {notebook.title}
            </h3>
            <p className="text-[0.875rem] leading-6">
              {sourcesLabel(notebook.sourceCount)} · {formatDay(notebook.createdAt)}
            </p>
          </>
        )}
      </header>

      <div className="mt-6">
        {loading && <SummarySkeleton />}
        {isError && <ErrorNotice error={error} onRetry={retry} retrying={retrying} />}
        {overview && !isError && (
          <>
            <p className="text-read text-body">
              <InlineText text={overview.summary} />
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-1">
              {kept === overview.summary ? (
                <p className="flex h-9 items-center gap-1.5 px-3 text-ui text-muted-foreground">
                  <Check className="size-4" aria-hidden />
                  In Notiz gespeichert
                </p>
              ) : (
                <Button
                  variant="ghost"
                  className="pr-3 pl-2"
                  tooltip="In Notiz speichern"
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate(
                      { title: SUMMARY_NOTE_TITLE, body: overview.summary },
                      { onSuccess: () => setKept(overview.summary) }
                    )
                  }
                >
                  <Pin />
                  In Notiz speichern
                </Button>
              )}
              <CopyButton
                label="Zusammenfassung kopieren"
                write={() => navigator.clipboard.writeText(withoutMarkers(overview.summary))}
              />
              {save.isError && (
                <span className="text-small text-destructive" role="alert">
                  {describeError(save.error)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
