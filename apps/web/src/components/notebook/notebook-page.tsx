import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ChatPanel } from '@/components/chat/chat-panel';
import { ChatSettingsDialog } from '@/components/chat/chat-settings-dialog';
import { AppHeader } from '@/components/layout/app-header';
import { Panel } from '@/components/notebook/panel';
import { ErrorNotice, ListSkeleton } from '@/components/query-boundary';
import { ReaderPanel, type ReaderTarget } from '@/components/reader/reader-panel';
import { SourcesPanel } from '@/components/sources/sources-panel';
import { StudioPanel } from '@/components/studio/studio-panel';
import { Button } from '@/components/ui/button';
import { useNotebook } from '@/hooks/use-notebooks';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

const COLUMN = { SOURCES: 'SOURCES', CHAT: 'CHAT', STUDIO: 'STUDIO' } as const;
type Column = (typeof COLUMN)[keyof typeof COLUMN];

const COLUMN_TAB: { column: Column; label: string }[] = [
  { column: COLUMN.SOURCES, label: 'Quellen' },
  { column: COLUMN.CHAT, label: 'Chat' },
  { column: COLUMN.STUDIO, label: 'Studio' },
];

// Shares of the window width, measured on the original: the side columns are a quarter each; with
// a Studio output open the Studio grows to 37.5 % and the sources give way to 20.6 %.
const SIDE_WIDTH = '24.58vw';
const SOURCES_WHILE_VIEWING = '20.6vw';
const STUDIO_WHILE_VIEWING = '37.5vw';
const RAIL_WIDTH = '3.5rem';

/**
 * One notebook in three columns like NotebookLM: sources (or the source text) on the left, the
 * conversation in the middle, the Studio and the notes on the right. Below the wide layout one
 * column shows at a time, switched from a bar under the header.
 */
export function NotebookPage() {
  const { notebookId = '' } = useParams();
  const notebook = useNotebook(notebookId);
  const [reading, setReading] = useState<ReaderTarget | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [studioOpen, setStudioOpen] = useState(true);
  const [column, setColumn] = useState<Column>(COLUMN.CHAT);
  const [viewingOutput, setViewingOutput] = useState(false);

  if (notebook.isPending) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto w-full max-w-xl p-6">
          <ListSkeleton />
        </div>
      </>
    );
  }
  if (notebook.isError) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto w-full max-w-xl p-6">
          <ErrorNotice
            error={notebook.error}
            onRetry={() => void notebook.refetch()}
            retrying={notebook.isFetching}
          />
        </div>
      </>
    );
  }
  if (!notebook.data) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 p-6">
          <h1 className="text-xl font-medium">Notizbuch nicht gefunden</h1>
          <p className="text-muted-foreground">
            Dieses Notizbuch gibt es nicht (mehr) in deinem Konto.
          </p>
          <Button asChild variant="outline">
            <Link to={ROUTES.HOME}>Zu deinen Notizbüchern</Link>
          </Button>
        </div>
      </>
    );
  }

  const { id, title } = notebook.data;
  const openReader = (target: ReaderTarget) => {
    setReading(target);
    setSourcesOpen(true);
    setColumn(COLUMN.SOURCES);
  };
  const hiddenBelowWide = (own: Column) => (column === own ? '' : 'max-wide:hidden');

  return (
    <>
      <AppHeader
        title={<h1 className="truncate text-xl">{title}</h1>}
        actions={<ChatSettingsDialog notebookId={id} />}
      />
      <nav
        aria-label="Bereiche"
        className="mx-4 mb-3 flex shrink-0 gap-0 rounded-full bg-secondary p-0.5 wide:hidden"
      >
        {COLUMN_TAB.map(({ column: own, label }) => (
          <button
            key={own}
            type="button"
            aria-current={column === own ? 'page' : undefined}
            onClick={() => setColumn(own)}
            className={cn(
              'h-7 flex-1 rounded-full text-ui font-title text-muted-foreground transition-colors',
              column === own && 'bg-card text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div
        className="grid min-h-0 flex-1 grid-cols-1 gap-2 px-4 pb-3 wide:px-3 wide:[grid-template-columns:var(--sources)_minmax(0,1fr)_var(--studio)]"
        style={
          {
            '--sources': sourcesOpen
              ? viewingOutput
                ? SOURCES_WHILE_VIEWING
                : SIDE_WIDTH
              : RAIL_WIDTH,
            '--studio': studioOpen
              ? viewingOutput
                ? STUDIO_WHILE_VIEWING
                : SIDE_WIDTH
              : RAIL_WIDTH,
          } as React.CSSProperties
        }
      >
        <Panel
          title="Quellen"
          side="left"
          collapsed={!sourcesOpen}
          onToggle={() => setSourcesOpen((value) => !value)}
          className={hiddenBelowWide(COLUMN.SOURCES)}
        >
          {reading ? (
            <ReaderPanel notebookId={id} target={reading} onClose={() => setReading(null)} />
          ) : (
            <SourcesPanel notebookId={id} onOpenSource={(sourceId) => openReader({ sourceId })} />
          )}
        </Panel>
        <Panel title="Chat" bare className={hiddenBelowWide(COLUMN.CHAT)}>
          <ChatPanel notebookId={id} onOpenCitation={(chunkId) => openReader({ chunkId })} />
        </Panel>
        <Panel
          title="Studio"
          side="right"
          titleHidden={viewingOutput}
          collapsed={!studioOpen}
          onToggle={() => setStudioOpen((value) => !value)}
          className={hiddenBelowWide(COLUMN.STUDIO)}
        >
          <StudioPanel
            notebookId={id}
            onOpenCitation={(chunkId) => openReader({ chunkId })}
            onViewingChange={setViewingOutput}
          />
        </Panel>
      </div>
    </>
  );
}
