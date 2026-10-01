import type { Note, StudioOutput } from '@nlm/shared';
import { useState } from 'react';

import { useCreateWrittenNote, useDeleteNote } from '@/hooks/use-notes';
import type { useOpenedEntry } from '@/hooks/use-opened-entry';
import {
  useCreateStudioOutput,
  useDeleteStudioOutput,
  useUpdateStudioOutput,
} from '@/hooks/use-studio';
import type { useStudioLibrary } from '@/hooks/use-studio-library';
import { ENTRY, type LibraryEntry, type OpenEntry } from '@/lib/library-entries';

/** The two questions the list can ask: delete this note, and what this output should be called. */
function useStudioQuestions() {
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [outputToRename, setOutputToRename] = useState<StudioOutput | null>(null);
  const closeQuestion = () => {
    setNoteToDelete(null);
    setOutputToRename(null);
  };
  return { noteToDelete, outputToRename, setNoteToDelete, setOutputToRename, closeQuestion };
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

/**
 * What can be done in the Studio: make, rename and delete outputs, make and delete notes, and open a
 * line of the list. The opened view is told through `show`, the folded column through `expand`.
 */
export function useStudioActions(
  notebookId: string,
  library: ReturnType<typeof useStudioLibrary>,
  show: ReturnType<typeof useOpenedEntry>['show'],
  expand: () => void
) {
  const create = useCreateStudioOutput(notebookId);
  const remove = useDeleteStudioOutput(notebookId);
  const update = useUpdateStudioOutput(notebookId);
  const removeNote = useDeleteNote(notebookId);
  const addNote = useCreateWrittenNote(notebookId);
  const questions = useStudioQuestions();

  const openEntry = (entry: OpenEntry) => {
    expand();
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
    entry.type === ENTRY.OUTPUT
      ? remove.mutate(entry.output.id)
      : questions.setNoteToDelete(entry.note);

  return {
    ...questions,
    create,
    remove,
    update,
    removeNote,
    addNote,
    openEntry,
    startNote,
    deletingId: deletingEntryId(remove, removeNote, questions.noteToDelete),
    // What the list asks for, in the shape the list takes.
    actions: {
      onOpen: openEntry,
      onRename: questions.setOutputToRename,
      onDelete: deleteEntry,
      onStartNote: startNote,
      onCreate: create.mutate,
    },
  };
}
