import { ChatPanel } from '@/components/chat/chat-panel';
import { ColumnGutter } from '@/components/notebook/column-gutter';
import { columnClasses, FLEX } from '@/components/notebook/notebook-layout';
import { Panel } from '@/components/notebook/panel';
import { CloseReaderButton, ReaderPanel } from '@/components/reader/reader-panel';
import { SourcesPanel } from '@/components/sources/sources-panel';
import { SourcesRail } from '@/components/sources/sources-rail';
import { StudioPanel } from '@/components/studio/studio-panel';
import { useColumnWidths } from '@/hooks/use-column-widths';
import type { AskedQuestion, useNotebookLayout } from '@/hooks/use-notebook-layout';
import { COLUMN_MIN_PX } from '@/lib/column-widths';
import { COLUMN, type Column } from '@/lib/columns';
import type { ReaderTarget } from '@/lib/reader-target';
import { cn } from '@/lib/utils';

interface ColumnProps {
  notebookId: string;
  /** The column that shows below the wide layout. */
  shown: Column;
  /** Folded into a rail (only in the wide layout). */
  folded: boolean;
  /** A strip between two columns is being dragged: the columns follow without their motion. */
  resizing: boolean;
}

/** The sources on the left; while a source or a cited passage is read, the text takes their place. */
export function SourcesColumn({
  notebookId,
  shown,
  folded,
  resizing,
  reading,
  onToggle,
  onOpenSource,
  onCloseReader,
}: ColumnProps & {
  reading: ReaderTarget | null;
  onToggle: () => void;
  onOpenSource: (sourceId: string) => void;
  onCloseReader: () => void;
}) {
  return (
    <Panel
      title="Quellen"
      side="left"
      collapsed={folded}
      onToggle={onToggle}
      action={reading ? <CloseReaderButton onClick={onCloseReader} /> : undefined}
      rail={<SourcesRail notebookId={notebookId} onOpenSource={onOpenSource} />}
      className={cn(
        columnClasses(shown, COLUMN.SOURCES, resizing),
        folded ? FLEX.RAIL : FLEX.SOURCES_SIDE
      )}
    >
      {reading ? (
        <ReaderPanel notebookId={notebookId} target={reading} />
      ) : (
        <SourcesPanel notebookId={notebookId} onOpenSource={onOpenSource} />
      )}
    </Panel>
  );
}

const chatFlex = (resized: boolean, filling: boolean) => {
  if (resized) return FLEX.CHAT_REST;
  return filling ? FLEX.CHAT_FILLING : FLEX.CHAT;
};

/** The conversation in the middle; it takes the room the folded side columns leave. */
export function ChatColumn({
  notebookId,
  shown,
  resizing,
  resized,
  sourcesFolded,
  studioFolded,
  asked,
  onOpenCitation,
  onCustomize,
}: Omit<ColumnProps, 'folded'> & {
  /** A side column was dragged to a width of its own; the chat is what is left. */
  resized: boolean;
  sourcesFolded: boolean;
  studioFolded: boolean;
  asked: AskedQuestion | null;
  onOpenCitation: (chunkId: string) => void;
  onCustomize: () => void;
}) {
  return (
    <Panel
      title="Chat"
      bare
      className={cn(
        columnClasses(shown, COLUMN.CHAT, resizing),
        chatFlex(resized, sourcesFolded || studioFolded),
        sourcesFolded && 'wide:ml-2',
        studioFolded && 'wide:mr-2'
      )}
    >
      <ChatPanel
        notebookId={notebookId}
        onOpenCitation={onOpenCitation}
        onCustomize={onCustomize}
        incoming={asked}
      />
    </Panel>
  );
}

/** The Studio and the notes on the right; it grows while something is open in it. */
export function StudioColumn({
  notebookId,
  shown,
  folded,
  resizing,
  viewing,
  onToggle,
  onExpand,
  onOpenCitation,
  onAsk,
  onViewingChange,
}: ColumnProps & {
  viewing: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onOpenCitation: (chunkId: string) => void;
  onAsk: (question: string) => void;
  onViewingChange: (viewing: boolean) => void;
}) {
  return (
    <StudioPanel
      notebookId={notebookId}
      collapsed={folded}
      onToggle={onToggle}
      onExpand={onExpand}
      onOpenCitation={onOpenCitation}
      onAsk={onAsk}
      onViewingChange={onViewingChange}
      className={cn(
        columnClasses(shown, COLUMN.STUDIO, resizing),
        folded ? FLEX.RAIL : FLEX.STUDIO_SIDE,
        viewing && !folded && FLEX.STUDIO_VIEWING
      )}
    />
  );
}

/** The width the Studio may not go below: the usual minimum, or what it asks for while it shows an output. */
const studioMinPx = (layout: ReturnType<typeof useNotebookLayout>) =>
  layout.viewingOutput ? Math.max(COLUMN_MIN_PX, window.innerWidth * 0.375) : COLUMN_MIN_PX;

/** The three columns side by side (or one at a time below the wide layout), with strips to drag. */
export function NotebookColumns({
  notebookId,
  layout,
  sourcesFolded,
  studioFolded,
  onCustomize,
}: {
  notebookId: string;
  layout: ReturnType<typeof useNotebookLayout>;
  sourcesFolded: boolean;
  studioFolded: boolean;
  onCustomize: () => void;
}) {
  const columns = useColumnWidths({
    [COLUMN.SOURCES]: sourcesFolded,
    [COLUMN.STUDIO]: studioFolded,
  });

  return (
    <div className="flex min-h-0 flex-1 px-4 wide:mx-3 wide:px-0" style={columns.variables}>
      <SourcesColumn
        notebookId={notebookId}
        shown={layout.column}
        folded={sourcesFolded}
        resizing={columns.resizing}
        reading={layout.reading}
        onToggle={layout.toggleSources}
        onOpenSource={layout.openSource}
        onCloseReader={layout.closeReader}
      />
      <ColumnGutter side={COLUMN.SOURCES} columns={columns} minPx={COLUMN_MIN_PX} />
      <ChatColumn
        notebookId={notebookId}
        shown={layout.column}
        resizing={columns.resizing}
        resized={columns.resized}
        sourcesFolded={sourcesFolded}
        studioFolded={studioFolded}
        asked={layout.asked}
        onOpenCitation={layout.openCitation}
        onCustomize={onCustomize}
      />
      <ColumnGutter side={COLUMN.STUDIO} columns={columns} minPx={studioMinPx(layout)} />
      <StudioColumn
        notebookId={notebookId}
        shown={layout.column}
        folded={studioFolded}
        resizing={columns.resizing}
        viewing={layout.viewingOutput}
        onToggle={layout.toggleStudio}
        onExpand={layout.expandStudio}
        onOpenCitation={layout.openCitation}
        onAsk={layout.askInChat}
        onViewingChange={layout.setViewingOutput}
      />
    </div>
  );
}
