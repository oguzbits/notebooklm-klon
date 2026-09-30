import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { ChatPanel } from '@/components/chat/chat-panel';
import { AppHeader } from '@/components/layout/app-header';
import { NotebookActions } from '@/components/notebook/notebook-actions';
import { NotebookTitle } from '@/components/notebook/notebook-title';
import { Panel } from '@/components/notebook/panel';
import { ErrorNotice } from '@/components/query-boundary';
import {
  CloseReaderButton,
  ReaderPanel,
  type ReaderTarget,
} from '@/components/reader/reader-panel';
import { SourcesPanel } from '@/components/sources/sources-panel';
import { StudioPanel } from '@/components/studio/studio-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

// The columns of the original are flex items in a container as wide as the window minus 12px each
// side: 25 % / 48 % / 25 % of it with 8px between them (the 2 % that is left stays empty on the right).
// While a Studio output is open the Studio takes 37.5 % of the window and the other two share the
// rest 10 : 19. A column that is folded away becomes a rail of 56px.
const FLEX = {
  SOURCES: 'wide:[flex:0_1_25%]',
  CHAT: 'wide:[flex:0_1_48%]',
  STUDIO: 'wide:[flex:0_1_25%]',
  SOURCES_WHILE_VIEWING: 'wide:[flex:10_1_0%]',
  CHAT_WHILE_VIEWING: 'wide:[flex:19_1_0%]',
  STUDIO_WHILE_VIEWING: 'wide:[flex:0_0_37.5vw]',
  CHAT_FILLING: 'wide:[flex:1_1_0%]',
  RAIL: 'wide:[flex:0_0_56px]',
} as const;

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
  if (!notebook.isPending && !notebook.data) {
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

  // While the notebook loads, the layout already stands and each column shows its own placeholder.
  const id = notebook.data?.id ?? notebookId;
  const openReader = (target: ReaderTarget) => {
    setReading(target);
    setSourcesOpen(true);
    setColumn(COLUMN.SOURCES);
  };
  const hiddenBelowWide = (own: Column) => (column === own ? '' : 'max-wide:hidden');

  return (
    <>
      <AppHeader
        title={
          notebook.data ? (
            <NotebookTitle key={notebook.data.title} notebook={notebook.data} />
          ) : (
            <Skeleton className="h-7 w-64 max-w-[40vw]" aria-hidden />
          )
        }
        actions={notebook.data ? <NotebookActions notebook={notebook.data} /> : undefined}
      />
      <nav
        aria-label="Bereiche"
        className="mx-4 mt-3 mb-3 flex shrink-0 gap-0 rounded-full bg-secondary p-0.5 wide:hidden"
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
      <div className="flex min-h-0 flex-1 px-4 wide:mx-3 wide:gap-2 wide:px-0">
        <Panel
          title="Quellen"
          side="left"
          collapsed={!sourcesOpen}
          onToggle={() => setSourcesOpen((value) => !value)}
          action={reading ? <CloseReaderButton onClick={() => setReading(null)} /> : undefined}
          className={cn(
            hiddenBelowWide(COLUMN.SOURCES),
            'w-full wide:w-auto wide:transition-[flex] wide:duration-200 wide:ease-in-out',
            !sourcesOpen ? FLEX.RAIL : viewingOutput ? FLEX.SOURCES_WHILE_VIEWING : FLEX.SOURCES
          )}
        >
          {reading ? (
            <ReaderPanel notebookId={id} target={reading} />
          ) : (
            <SourcesPanel notebookId={id} onOpenSource={(sourceId) => openReader({ sourceId })} />
          )}
        </Panel>
        <Panel
          title="Chat"
          bare
          className={cn(
            hiddenBelowWide(COLUMN.CHAT),
            'w-full wide:w-auto wide:transition-[flex] wide:duration-200 wide:ease-in-out',
            !sourcesOpen || !studioOpen
              ? FLEX.CHAT_FILLING
              : viewingOutput
                ? FLEX.CHAT_WHILE_VIEWING
                : FLEX.CHAT,
            !sourcesOpen && 'wide:ml-2',
            !studioOpen && 'wide:mr-2'
          )}
        >
          <ChatPanel notebookId={id} onOpenCitation={(chunkId) => openReader({ chunkId })} />
        </Panel>
        <Panel
          title="Studio"
          side="right"
          titleHidden={viewingOutput}
          collapsed={!studioOpen}
          onToggle={() => setStudioOpen((value) => !value)}
          className={cn(
            hiddenBelowWide(COLUMN.STUDIO),
            'w-full wide:w-auto wide:transition-[flex] wide:duration-200 wide:ease-in-out',
            !studioOpen ? FLEX.RAIL : viewingOutput ? FLEX.STUDIO_WHILE_VIEWING : FLEX.STUDIO
          )}
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
