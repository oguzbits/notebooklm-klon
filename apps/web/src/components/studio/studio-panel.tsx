import { SOURCE_STATUS } from '@nlm/shared';

import { Panel } from '@/components/notebook/panel';
import { StudioBody } from '@/components/studio/studio-body';
import { StudioDialogs } from '@/components/studio/studio-dialogs';
import { StudioRail } from '@/components/studio/studio-rail';
import { CloseViewerButton, viewerLabels, ViewerPath } from '@/components/studio/studio-viewer';
import { useOpenedEntry } from '@/hooks/use-opened-entry';
import { useSources } from '@/hooks/use-sources';
import { useStudioActions } from '@/hooks/use-studio-actions';
import { useStudioLibrary } from '@/hooks/use-studio-library';

interface StudioPanelProps {
  notebookId: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Opens the folded column, for a symbol on the rail that leads to something inside it. */
  onExpand: () => void;
  className?: string;
  onOpenCitation: (chunkId: string) => void;
  /** Asks the chat a question: a card or a quiz question is explained there. */
  onAsk: (question: string) => void;
  /** Tells the page whether something is open, because the Studio grows while it is. */
  onViewingChange?: (viewing: boolean) => void;
}

/**
 * The right column: make reports, flashcards, quizzes and mind maps; open them; keep notes. It owns
 * its panel, because an open thing writes its own path into the header ("Studio › Notiz") and takes
 * the place of the fold button there.
 */
export function StudioPanel({
  notebookId,
  collapsed,
  onToggle,
  onExpand,
  className,
  onOpenCitation,
  onAsk,
  onViewingChange,
}: StudioPanelProps) {
  const library = useStudioLibrary(notebookId);
  const sources = useSources(notebookId);
  const { openedOutput, openedNote, show } = useOpenedEntry(
    library.outputs.data,
    library.notes.data,
    onViewingChange
  );
  const studio = useStudioActions(notebookId, library, show, onExpand);

  const usable = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  );
  const opened = openedOutput ?? openedNote;
  const labels = viewerLabels(openedOutput);
  const back = () => show(null);

  return (
    <Panel
      title="Studio"
      side="right"
      collapsed={collapsed}
      onToggle={onToggle}
      header={opened && <ViewerPath crumb={labels.crumb} onBack={back} />}
      action={opened && <CloseViewerButton label={labels.closeLabel} onClick={back} />}
      rail={<StudioRail library={library} sources={usable} studio={studio} />}
      className={className}
    >
      <StudioBody
        notebookId={notebookId}
        studio={studio}
        library={library}
        sources={{ usable, loaded: sources.isSuccess }}
        output={openedOutput}
        note={openedNote}
        onOpenCitation={onOpenCitation}
        onAsk={onAsk}
      />
      <StudioDialogs
        noteToDelete={studio.noteToDelete}
        outputToDelete={studio.outputToDelete}
        outputToRename={studio.outputToRename}
        removeNote={studio.removeNote}
        removeOutput={studio.remove}
        update={studio.update}
        onClose={studio.closeQuestion}
        onDone={back}
      />
    </Panel>
  );
}
