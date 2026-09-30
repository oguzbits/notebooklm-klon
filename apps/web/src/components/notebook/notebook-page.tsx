import { FileText, MessageSquare, Shapes } from 'lucide-react';
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

const COLUMN_TAB: { column: Column; label: string; icon: typeof FileText }[] = [
  { column: COLUMN.SOURCES, label: 'Quellen', icon: FileText },
  { column: COLUMN.CHAT, label: 'Chat', icon: MessageSquare },
  { column: COLUMN.STUDIO, label: 'Studio', icon: Shapes },
];

const SIDE_WIDTH = '21rem';
const STUDIO_WIDTH = '23rem';
const RAIL_WIDTH = '3.5rem';

/**
 * One notebook in three columns like NotebookLM: sources (or the source text) on the left, the
 * conversation in the middle, the Studio and the notes on the right. Below the wide layout one
 * column shows at a time, switched from a bar at the bottom.
 */
export function NotebookPage() {
  const { notebookId = '' } = useParams();
  const notebook = useNotebook(notebookId);
  const [reading, setReading] = useState<ReaderTarget | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [studioOpen, setStudioOpen] = useState(true);
  const [column, setColumn] = useState<Column>(COLUMN.CHAT);

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
  const hiddenBelowWide = (own: Column) => (column === own ? '' : 'max-lg:hidden');

  return (
    <>
      <AppHeader
        title={<h1 className="truncate text-lg font-medium sm:text-xl">{title}</h1>}
        actions={<ChatSettingsDialog notebookId={id} />}
      />
      <div
        className="grid min-h-0 flex-1 gap-3 px-3 pb-3 max-lg:grid-cols-1 sm:px-4 sm:pb-4 lg:[grid-template-columns:var(--sources)_minmax(0,1fr)_var(--studio)]"
        style={
          {
            '--sources': sourcesOpen ? SIDE_WIDTH : RAIL_WIDTH,
            '--studio': studioOpen ? STUDIO_WIDTH : RAIL_WIDTH,
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
        <Panel title="Chat" className={hiddenBelowWide(COLUMN.CHAT)}>
          <ChatPanel notebookId={id} onOpenCitation={(chunkId) => openReader({ chunkId })} />
        </Panel>
        <Panel
          title="Studio"
          side="right"
          collapsed={!studioOpen}
          onToggle={() => setStudioOpen((value) => !value)}
          className={hiddenBelowWide(COLUMN.STUDIO)}
        >
          <StudioPanel notebookId={id} onOpenCitation={(chunkId) => openReader({ chunkId })} />
        </Panel>
      </div>
      <nav
        aria-label="Bereiche"
        className="flex shrink-0 justify-around gap-1 bg-card px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        {COLUMN_TAB.map(({ column: own, label, icon: Icon }) => (
          <button
            key={own}
            type="button"
            aria-current={column === own ? 'page' : undefined}
            onClick={() => setColumn(own)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-medium text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              column === own && 'bg-accent text-accent-foreground'
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
