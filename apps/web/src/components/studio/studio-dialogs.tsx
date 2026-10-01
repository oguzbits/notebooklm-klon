import { type Note, NOTE_KIND, type StudioOutput } from '@nlm/shared';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RenameDialog } from '@/components/ui/rename-dialog';
import type { useDeleteNote } from '@/hooks/use-notes';
import type { useUpdateStudioOutput } from '@/hooks/use-studio';
import { describeError } from '@/lib/messages';

/** Asks before a note is deleted; only a saved answer has a copy that stays in the chat. */
export function DeleteNoteDialog({
  note,
  pending,
  onCancel,
  onConfirm,
}: {
  note: Note | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (noteId: string) => void;
}) {
  return (
    <ConfirmDialog
      open={note !== null}
      onOpenChange={(isOpen) => !isOpen && onCancel()}
      title="Notiz löschen?"
      description={
        note?.kind === NOTE_KIND.WRITTEN
          ? 'Die Notiz wird gelöscht.'
          : 'Die Notiz wird gelöscht. Die Antwort im Chat bleibt erhalten.'
      }
      pending={pending}
      onConfirm={() => note && onConfirm(note.id)}
    />
  );
}

/** Changes the name of an output. */
export function RenameOutputDialog({
  output,
  pending,
  error,
  onCancel,
  onSave,
}: {
  output: StudioOutput | null;
  pending: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (outputId: string, title: string, close: () => void) => void;
}) {
  return (
    <RenameDialog
      heading="Umbenennen"
      label="Name"
      value={output?.title ?? ''}
      open={output !== null}
      onOpenChange={(isOpen) => !isOpen && onCancel()}
      pending={pending}
      error={error ? describeError(error) : null}
      onSave={(title, close) => output && onSave(output.id, title, close)}
    />
  );
}

type RemoveNote = ReturnType<typeof useDeleteNote>;
type Update = ReturnType<typeof useUpdateStudioOutput>;

/** The two questions the list can ask: delete this note, and what an output should be called. */
export function StudioDialogs({
  noteToDelete,
  outputToRename,
  removeNote,
  update,
  onClose,
  onDone,
}: {
  noteToDelete: Note | null;
  outputToRename: StudioOutput | null;
  removeNote: RemoveNote;
  update: Update;
  /** Closes the question that is open. */
  onClose: () => void;
  /** A deleted note was open: the view goes back to the list. */
  onDone: () => void;
}) {
  return (
    <>
      <DeleteNoteDialog
        note={noteToDelete}
        pending={removeNote.isPending}
        onCancel={onClose}
        onConfirm={(noteId) =>
          removeNote.mutate(noteId, {
            onSuccess: () => {
              onClose();
              onDone();
            },
          })
        }
      />
      <RenameOutputDialog
        output={outputToRename}
        pending={update.isPending}
        error={update.error}
        onCancel={onClose}
        onSave={(outputId, title, close) =>
          update.mutate({ outputId, changes: { title } }, { onSuccess: close })
        }
      />
    </>
  );
}
