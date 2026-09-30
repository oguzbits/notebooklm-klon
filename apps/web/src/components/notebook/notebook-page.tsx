import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ChatPanel } from '@/components/chat/chat-panel';
import { ErrorNotice, ListSkeleton } from '@/components/query-boundary';
import { ReaderPanel, type ReaderTarget } from '@/components/reader/reader-panel';
import { SourcesPanel } from '@/components/sources/sources-panel';
import { Button } from '@/components/ui/button';
import { useNotebook } from '@/hooks/use-notebooks';
import { ROUTES } from '@/lib/routes';

/** One notebook: sources (or the reader) on the left, the conversation on the right. */
export function NotebookPage() {
  const { notebookId = '' } = useParams();
  const notebook = useNotebook(notebookId);
  const [reading, setReading] = useState<ReaderTarget | null>(null);

  if (notebook.isPending) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ListSkeleton />
      </div>
    );
  }
  if (notebook.isError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorNotice
          error={notebook.error}
          onRetry={() => void notebook.refetch()}
          retrying={notebook.isFetching}
        />
      </div>
    );
  }
  if (!notebook.data) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-semibold">Notizbuch nicht gefunden</h1>
        <p className="text-muted-foreground">
          Dieses Notizbuch gibt es nicht (mehr) in deinem Konto.
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTES.HOME}>Zu deinen Notizbüchern</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Zu deinen Notizbüchern">
          <Link to={ROUTES.HOME}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="truncate text-base font-semibold">{notebook.data.title}</h1>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-cols-[minmax(20rem,26rem)_1fr] lg:grid-rows-1">
        <aside className="min-h-0 border-b bg-card lg:border-r lg:border-b-0">
          {reading ? (
            <ReaderPanel
              notebookId={notebook.data.id}
              target={reading}
              onClose={() => setReading(null)}
            />
          ) : (
            <SourcesPanel
              notebookId={notebook.data.id}
              onOpenSource={(sourceId) => setReading({ sourceId })}
            />
          )}
        </aside>
        <section className="min-h-0">
          <ChatPanel
            notebookId={notebook.data.id}
            onOpenCitation={(chunkId) => setReading({ chunkId })}
          />
        </section>
      </div>
    </div>
  );
}
