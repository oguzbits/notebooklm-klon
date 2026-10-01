import { ChatPanel } from '@/components/chat/chat-panel';
import { columnClasses, FLEX } from '@/components/notebook/notebook-layout';
import { Panel } from '@/components/notebook/panel';
import { CloseReaderButton, ReaderPanel } from '@/components/reader/reader-panel';
import { SourcesPanel } from '@/components/sources/sources-panel';
import { SourcesRail } from '@/components/sources/sources-rail';
import { StudioPanel } from '@/components/studio/studio-panel';
import type { AskedQuestion } from '@/hooks/use-notebook-layout';
import { COLUMN, type Column } from '@/lib/columns';
import type { ReaderTarget } from '@/lib/reader-target';
import { cn } from '@/lib/utils';

interface ColumnProps {
  notebookId: string;
  /** The column that shows below the wide layout. */
  shown: Column;
  /** Folded into a rail (only in the wide layout). */
  folded: boolean;
}

/** The sources on the left; while a source or a cited passage is read, the text takes their place. */
export function SourcesColumn({
  notebookId,
  shown,
  folded,
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
      className={cn(columnClasses(shown, COLUMN.SOURCES), folded ? FLEX.RAIL : FLEX.SIDE)}
    >
      {reading ? (
        <ReaderPanel notebookId={notebookId} target={reading} />
      ) : (
        <SourcesPanel notebookId={notebookId} onOpenSource={onOpenSource} />
      )}
    </Panel>
  );
}

/** The conversation in the middle; it takes the room the folded side columns leave. */
export function ChatColumn({
  notebookId,
  shown,
  sourcesFolded,
  studioFolded,
  asked,
  onOpenCitation,
  onCustomize,
}: Omit<ColumnProps, 'folded'> & {
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
        columnClasses(shown, COLUMN.CHAT),
        sourcesFolded || studioFolded ? FLEX.CHAT_FILLING : FLEX.CHAT,
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
        columnClasses(shown, COLUMN.STUDIO),
        folded ? FLEX.RAIL : FLEX.SIDE,
        viewing && !folded && FLEX.STUDIO_VIEWING
      )}
    />
  );
}
