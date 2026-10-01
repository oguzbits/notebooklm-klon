import { type Note, SOURCE_STATUS, type StudioOutput } from '@nlm/shared';
import { useState } from 'react';

import { Panel } from '@/components/notebook/panel';
import { DeleteNoteDialog, RenameOutputDialog } from '@/components/studio/studio-dialogs';
import { StudioHome } from '@/components/studio/studio-home';
import { StudioRail } from '@/components/studio/studio-rail';
import {
  CloseViewerButton,
  OpenedEntry,
  viewerLabels,
  ViewerPath,
} from '@/components/studio/studio-viewer';
import { useCreateWrittenNote, useDeleteNote } from '@/hooks/use-notes';
import { useOpenedEntry } from '@/hooks/use-opened-entry';
import { useSources } from '@/hooks/use-sources';
import {
  useCreateStudioOutput,
  useDeleteStudioOutput,
  useUpdateStudioOutput,
} from '@/hooks/use-studio';
import { useStudioLibrary } from '@/hooks/use-studio-library';
import { ENTRY, type LibraryEntry, type OpenEntry } from '@/lib/library-entries';

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
  const create = useCreateStudioOutput(notebookId);
  const remove = useDeleteStudioOutput(notebookId);
  const update = useUpdateStudioOutput(notebookId);
  const removeNote = useDeleteNote(notebookId);
  const addNote = useCreateWrittenNote(notebookId);
  const { openedOutput, openedNote, show } = useOpenedEntry(
    library.outputs.data,
    library.notes.data,
    onViewingChange
  );
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [outputToRename, setOutputToRename] = useState<StudioOutput | null>(null);

  const usable = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  );
  const noteBlocked = addNote.isPending || library.notes.isPending;

  const openEntry = (entry: OpenEntry) => {
    onExpand();
    show(entry);
    // The blue dot goes out once the output was opened.
    const output =
      entry.type === ENTRY.OUTPUT
        ? library.outputs.data?.find((item) => item.id === entry.id)
        : undefined;
    if (output?.unread) update.mutate({ outputId: output.id, changes: { read: true } });
  };
  // Like in the original, an empty note is made at once and opens, so the reader can start typing.
  const startNote = () =>
    addNote.mutate(undefined, {
      onSuccess: (created) => openEntry({ type: ENTRY.NOTE, id: created.id }),
    });
  const deleteEntry = (entry: LibraryEntry) =>
    entry.type === ENTRY.OUTPUT ? remove.mutate(entry.output.id) : setNoteToDelete(entry.note);
  const back = () => show(null);

  const opened = openedOutput ?? openedNote;
  const labels = viewerLabels(openedOutput);
  const deletingId = deletingEntryId(remove, removeNote, noteToDelete);
  // The result is not opened by itself: it joins the list with a blue dot, and the reader opens it.
  const actions = {
    onOpen: openEntry,
    onRename: setOutputToRename,
    onDelete: deleteEntry,
    onStartNote: startNote,
    onCreate: create.mutate,
  };

  return (
    <Panel
      title="Studio"
      side="right"
      collapsed={collapsed}
      onToggle={onToggle}
      header={opened && <ViewerPath crumb={labels.crumb} onBack={back} />}
      action={opened && <CloseViewerButton label={labels.closeLabel} onClick={back} />}
      rail={
        <StudioRail
          entries={library.entries}
          sources={usable}
          blocked={usable.length === 0 || create.isPending}
          noteBlocked={noteBlocked}
          onCreate={create.mutate}
          onOpen={openEntry}
          onStartNote={startNote}
        />
      }
      className={className}
    >
      {opened ? (
        <OpenedEntry
          notebookId={notebookId}
          output={openedOutput}
          note={openedNote}
          deletingOutput={remove.isPending}
          deletingNote={removeNote.isPending}
          onDeleteOutput={(outputId) => remove.mutate(outputId, { onSuccess: back })}
          onDeleteNote={setNoteToDelete}
          onOpenCitation={onOpenCitation}
          onAsk={onAsk}
        />
      ) : (
        <StudioHome
          library={library}
          sources={{ usable, loaded: sources.isSuccess }}
          create={create}
          remove={remove}
          removeNote={removeNote}
          addNote={addNote}
          deletingId={deletingId}
          actions={actions}
        />
      )}
      <DeleteNoteDialog
        note={noteToDelete}
        pending={removeNote.isPending}
        onCancel={() => setNoteToDelete(null)}
        onConfirm={(noteId) =>
          removeNote.mutate(noteId, {
            onSuccess: () => {
              setNoteToDelete(null);
              back();
            },
          })
        }
      />
      <RenameOutputDialog
        output={outputToRename}
        pending={update.isPending}
        error={update.error}
        onCancel={() => setOutputToRename(null)}
        onSave={(outputId, title, close) =>
          update.mutate({ outputId, changes: { title } }, { onSuccess: close })
        }
      />
    </Panel>
  );
}

/** The line whose deletion is under way, if any. */
function deletingEntryId(
  remove: ReturnType<typeof useDeleteStudioOutput>,
  removeNote: ReturnType<typeof useDeleteNote>,
  noteToDelete: Note | null
): string | null {
  if (remove.isPending) return remove.variables;
  if (removeNote.isPending) return noteToDelete?.id ?? null;
  return null;
}
