import type { Notebook, SourceSummary } from '@nlm/shared';
import { Check, Mountain, Pin } from 'lucide-react';
import { useState } from 'react';

import { InlineText } from '@/components/chat/inline-text';
import { ErrorNotice } from '@/components/query-boundary';
import { COVER_BOX, SummarySkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { useNotebookOverview } from '@/hooks/use-notebook-overview';
import { coverUrl, useNotebook } from '@/hooks/use-notebooks';
import { useCreateWrittenNote } from '@/hooks/use-notes';
import { formatDay } from '@/lib/day';
import { describeError } from '@/lib/messages';
import { notebookEmoji } from '@/lib/notebook-emoji';
import { withoutMarkers } from '@/lib/plain-text';
import { sourcesLabel } from '@/lib/sources-label';
import { cn } from '@/lib/utils';

const SUMMARY_NOTE_TITLE = 'Zusammenfassung';

/** What lies behind the title: the picture with its fade, or the symbol; both react to the pointer. */
function CoverBackdrop({ emoji, cover }: { emoji: string; cover: string | null }) {
  return (
    <>
      {cover ? (
        <>
          {/* The picture of the reader fills the cover; the fade keeps the title readable on it. */}
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
          />
          <span
            aria-hidden
            data-cover-hover="veil"
            className="pointer-events-none absolute inset-0 bg-background opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08]"
          />
        </>
      ) : (
        <>
          <Mountain
            aria-hidden
            data-cover-hover="landscape"
            fill="currentColor"
            strokeWidth={0}
            className="pointer-events-none absolute right-0 -bottom-8 size-48 text-foreground/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          <span
            aria-hidden
            className="absolute top-6 left-6 flex size-10 items-center justify-center text-[40px] leading-10"
          >
            {emoji}
          </span>
        </>
      )}
    </>
  );
}

/** The cover: the picture or the symbol of the notebook, its title and how many sources it holds. */
function OverviewCover({
  notebook,
  emoji,
  cover,
  onCustomize,
}: {
  notebook: Notebook | undefined;
  emoji: string;
  cover: string | null;
  onCustomize: () => void;
}) {
  return (
    // The size is shared with its placeholder; on hover the panel fills (no picture) or gets a veil.
    <header
      className={cn(
        'group relative flex flex-col justify-end overflow-hidden px-6 pb-6',
        COVER_BOX,
        !cover && 'transition-colors duration-200 hover:bg-muted'
      )}
    >
      <CoverBackdrop emoji={emoji} cover={cover} />
      {/* Like the original: the whole cover is one invisible control that opens "Notebook anpassen". */}
      <button
        type="button"
        aria-label="Notebook anpassen"
        onClick={onCustomize}
        className="absolute inset-0 cursor-pointer rounded-panel"
      />
      {notebook && (
        <>
          <h3
            id="notebook-overview-title"
            className="relative text-[2.25rem] leading-[2.75rem] font-[320] break-words"
          >
            {notebook.title}
          </h3>
          <p className="relative text-[0.875rem] leading-6">
            {sourcesLabel(notebook.sourceCount)} · {formatDay(notebook.createdAt)}
          </p>
        </>
      )}
    </header>
  );
}

/** Keep the summary as a note (the note then says so), or copy it. */
function SummaryActions({ notebookId, summary }: { notebookId: string; summary: string }) {
  const save = useCreateWrittenNote(notebookId);
  // The summary that was kept as a note; a new summary can be kept again.
  const [kept, setKept] = useState<string | null>(null);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-1">
      {kept === summary ? (
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
              { title: SUMMARY_NOTE_TITLE, body: summary },
              { onSuccess: () => setKept(summary) }
            )
          }
        >
          <Pin />
          In Notiz speichern
        </Button>
      )}
      <CopyButton
        label="Zusammenfassung kopieren"
        write={() => navigator.clipboard.writeText(withoutMarkers(summary))}
      />
      {save.isError && (
        <span className="text-small text-destructive" role="alert">
          {describeError(save.error)}
        </span>
      )}
    </div>
  );
}

/** Under the cover: the summary while it loads, its failure, or the text with what can be done with it. */
function OverviewBody({
  notebookId,
  overview,
  loading,
  failure,
}: {
  notebookId: string;
  overview: { summary: string } | null | undefined;
  loading: boolean;
  failure: { error: unknown; retry: () => void; retrying: boolean } | null;
}) {
  return (
    <div className="mt-6">
      {loading && <SummarySkeleton />}
      {failure && (
        <ErrorNotice error={failure.error} onRetry={failure.retry} retrying={failure.retrying} />
      )}
      {overview && !failure && (
        <>
          <p className="text-read text-body [&_strong]:font-[600]">
            <InlineText text={overview.summary} />
          </p>
          <SummaryActions notebookId={notebookId} summary={overview.summary} />
        </>
      )}
    </div>
  );
}

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
  if (!ready) return null;

  const emoji = overview?.emoji ?? notebook?.emoji ?? notebookEmoji(notebookId);
  const cover = notebook?.coverVersion ? coverUrl(notebook.id, notebook.coverVersion) : null;

  return (
    <section aria-labelledby="notebook-overview-title" className="-mt-2">
      <OverviewCover notebook={notebook} emoji={emoji} cover={cover} onCustomize={onCustomize} />
      <OverviewBody
        notebookId={notebookId}
        overview={overview}
        loading={loading}
        failure={isError ? { error, retry, retrying } : null}
      />
    </section>
  );
}
