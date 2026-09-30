import { BookmarkCheck, BookmarkPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCreateNote, useNotes } from '@/hooks/use-notes';
import { describeError } from '@/lib/messages';

/** Under an answer: saves it as a note, or says that it already is one. */
export function SaveNoteButton({
  notebookId,
  messageId,
}: {
  notebookId: string;
  messageId: string;
}) {
  const notes = useNotes(notebookId);
  const create = useCreateNote(notebookId);

  if (notes.data?.some((note) => note.messageId === messageId)) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <BookmarkCheck className="size-3.5" aria-hidden />
        Als Notiz gespeichert
      </p>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2">
      <Button
        variant="ghost"
        size="xs"
        disabled={create.isPending || notes.isPending}
        onClick={() => create.mutate(messageId)}
      >
        <BookmarkPlus />
        Als Notiz speichern
      </Button>
      {create.isError && (
        <span className="text-xs text-destructive" role="alert">
          {describeError(create.error)}
        </span>
      )}
    </div>
  );
}
