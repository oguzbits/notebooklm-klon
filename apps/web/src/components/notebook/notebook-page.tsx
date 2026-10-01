import { useCallback, useState } from 'react';
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
import { SourcesRail } from '@/components/sources/sources-rail';
import { StudioPanel } from '@/components/studio/studio-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotebook } from '@/hooks/use-notebooks';
import { useWideLayout } from '@/hooks/use-wide-layout';
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
// The chat always fills what the side columns leave, but never more than 48 % while both are open.
// While a Studio output is open the Studio asks for at least 37.5 % of the window (`min-width`) and
// the other two give way in proportion to their size, exactly the way the original does it. A column
// that is folded away becomes a rail of 56px. Everything that changes between these states is a
// length, so the browser can move it smoothly in both directions (nothing flips at the start or the
// end, which is what made the earlier version jump).
const MOTION =
  'wide:transition-[flex-basis,min-width,max-width,margin] wide:duration-200 wide:ease-in-out';
const FLEX = {
  SIDE: 'wide:[flex:0_1_25%]',
  RAIL: 'wide:[flex:0_0_56px]',
  CHAT: 'wide:[flex:1_1_48%] wide:max-w-[48%]',
  CHAT_FILLING: 'wide:[flex:1_1_48%] wide:max-w-full',
  STUDIO_VIEWING: 'wide:min-w-[37.5vw]',
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
  // A question that came from the Studio ("Erklären" on a card); the chat asks it once.
  const [asked, setAsked] = useState<{ id: number; question: string } | null>(null);
  const wide = useWideLayout();

  // The columns are memoized, so folding one (or opening something in the Studio) does not render the
  // others again; for that these functions must keep their identity.
  const openReader = useCallback((target: ReaderTarget) => {
    setReading(target);
    setSourcesOpen(true);
    setColumn(COLUMN.SOURCES);
  }, []);
  const openSource = useCallback((sourceId: string) => openReader({ sourceId }), [openReader]);
  const openCitation = useCallback((chunkId: string) => openReader({ chunkId }), [openReader]);
  const expandStudio = useCallback(() => setStudioOpen(true), []);
  const askInChat = useCallback((question: string) => {
    setAsked((current) => ({ id: (current?.id ?? 0) + 1, question }));
    setColumn(COLUMN.CHAT);
  }, []);
  const toggleStudio = useCallback(() => setStudioOpen((value) => !value), []);

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
  const hiddenBelowWide = (own: Column) => (column === own ? '' : 'max-wide:hidden');
  // Only the wide layout has rails; below it every column is shown whole.
  const sourcesFolded = wide && !sourcesOpen;
  const studioFolded = wide && !studioOpen;

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
          collapsed={sourcesFolded}
          onToggle={() => setSourcesOpen((value) => !value)}
          action={reading ? <CloseReaderButton onClick={() => setReading(null)} /> : undefined}
          rail={
            <SourcesRail notebookId={id} onOpenSource={(sourceId) => openReader({ sourceId })} />
          }
          className={cn(
            hiddenBelowWide(COLUMN.SOURCES),
            'w-full wide:w-auto',
            MOTION,
            sourcesFolded ? FLEX.RAIL : FLEX.SIDE
          )}
        >
          {reading ? (
            <ReaderPanel notebookId={id} target={reading} />
          ) : (
            <SourcesPanel notebookId={id} onOpenSource={openSource} />
          )}
        </Panel>
        <Panel
          title="Chat"
          bare
          className={cn(
            hiddenBelowWide(COLUMN.CHAT),
            'w-full wide:w-auto',
            MOTION,
            sourcesFolded || studioFolded ? FLEX.CHAT_FILLING : FLEX.CHAT,
            sourcesFolded && 'wide:ml-2',
            studioFolded && 'wide:mr-2'
          )}
        >
          <ChatPanel notebookId={id} onOpenCitation={openCitation} incoming={asked} />
        </Panel>
        <StudioPanel
          notebookId={id}
          collapsed={studioFolded}
          onToggle={toggleStudio}
          onExpand={expandStudio}
          onOpenCitation={openCitation}
          onAsk={askInChat}
          onViewingChange={setViewingOutput}
          className={cn(
            hiddenBelowWide(COLUMN.STUDIO),
            'w-full wide:w-auto',
            MOTION,
            studioFolded ? FLEX.RAIL : FLEX.SIDE,
            viewingOutput && !studioFolded && FLEX.STUDIO_VIEWING
          )}
        />
      </div>
    </>
  );
}
