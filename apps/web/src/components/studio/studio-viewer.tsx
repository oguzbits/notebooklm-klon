import type { Note, StudioOutput } from '@nlm/shared';
import { ChevronRight, Minimize2 } from 'lucide-react';

import { NoteViewer } from '@/components/studio/note-viewer';
import { OutputViewer } from '@/components/studio/output-viewer';
import { CLOSE_NOTE_LABEL, CLOSE_VIEW_LABEL, KIND_LABEL } from '@/components/studio/studio-labels';
import { Button } from '@/components/ui/button';

/** The path back in the header of the column while something is open: "Studio › Notiz". */
export function ViewerPath({ crumb, onBack }: { crumb: string; onBack: () => void }) {
  return (
    <nav aria-label="Pfad" className="flex min-w-0 items-center gap-1 text-ui">
      <button type="button" aria-label="Zurück zum Studio" onClick={onBack} className="rounded-md">
        Studio
      </button>
      <ChevronRight className="size-5 shrink-0" aria-hidden />
      <span className="truncate" aria-current="page">
        {crumb}
      </span>
    </nav>
  );
}

/** The button that closes the view and takes the place of the fold button in the header. */
export function CloseViewerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} tooltip={label} onClick={onClick}>
      <Minimize2 />
    </Button>
  );
}

/** The words around what is open: its name in the path and on the button that closes it. */
export function viewerLabels(output: StudioOutput | undefined) {
  return output
    ? { crumb: KIND_LABEL[output.kind], closeLabel: CLOSE_VIEW_LABEL[output.kind] }
    : { crumb: 'Notiz', closeLabel: CLOSE_NOTE_LABEL };
}

/** The full view of the output or the note that is open. */
export function OpenedEntry({
  notebookId,
  output,
  note,
  deletingOutput,
  deletingNote,
  onDeleteOutput,
  onDeleteNote,
  onOpenCitation,
  onAsk,
}: {
  notebookId: string;
  output: StudioOutput | undefined;
  note: Note | undefined;
  deletingOutput: boolean;
  deletingNote: boolean;
  onDeleteOutput: (output: StudioOutput) => void;
  onDeleteNote: (note: Note) => void;
  onOpenCitation: (chunkId: string) => void;
  onAsk: (question: string) => void;
}) {
  if (output) {
    return (
      <OutputViewer
        notebookId={notebookId}
        output={output}
        deleting={deletingOutput}
        onDelete={() => onDeleteOutput(output)}
        onOpenCitation={onOpenCitation}
        onAsk={onAsk}
      />
    );
  }
  if (!note) return null;
  return (
    <NoteViewer
      key={note.id}
      notebookId={notebookId}
      note={note}
      deleting={deletingNote}
      onDelete={() => onDeleteNote(note)}
      onOpenCitation={onOpenCitation}
    />
  );
}
