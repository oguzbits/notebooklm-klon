import type { Note, SourceSummary, StudioOutput } from '@nlm/shared';

import { StudioHome } from '@/components/studio/studio-home';
import { OpenedEntry } from '@/components/studio/studio-viewer';
import type { useStudioActions } from '@/hooks/use-studio-actions';
import type { useStudioLibrary } from '@/hooks/use-studio-library';

type Studio = ReturnType<typeof useStudioActions>;

/** What fills the column: the output or note that is open, or else the home view of the Studio. */
export function StudioBody({
  notebookId,
  studio,
  library,
  sources,
  output,
  note,
  onBack,
  onOpenCitation,
  onAsk,
}: {
  notebookId: string;
  studio: Studio;
  library: ReturnType<typeof useStudioLibrary>;
  sources: { usable: SourceSummary[]; loaded: boolean };
  output: StudioOutput | undefined;
  note: Note | undefined;
  onBack: () => void;
  onOpenCitation: (chunkId: string) => void;
  onAsk: (question: string) => void;
}) {
  if (output || note) {
    return (
      <OpenedEntry
        notebookId={notebookId}
        output={output}
        note={note}
        deletingOutput={studio.remove.isPending}
        deletingNote={studio.removeNote.isPending}
        onDeleteOutput={(outputId) => studio.remove.mutate(outputId, { onSuccess: onBack })}
        onDeleteNote={studio.setNoteToDelete}
        onOpenCitation={onOpenCitation}
        onAsk={onAsk}
      />
    );
  }
  return (
    <StudioHome
      library={library}
      sources={sources}
      create={studio.create}
      remove={studio.remove}
      removeNote={studio.removeNote}
      addNote={studio.addNote}
      deletingId={studio.deletingId}
      actions={studio.actions}
    />
  );
}
