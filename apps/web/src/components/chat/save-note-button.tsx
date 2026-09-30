import { Check, Pin } from 'lucide-react';

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
      <p className="flex h-8 items-center gap-1.5 px-3 text-ui text-muted-foreground">
        <Check className="size-4" aria-hidden />
        Als Notiz gespeichert
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={create.isPending || notes.isPending}
        onClick={() => create.mutate(messageId)}
      >
        <Pin />
        Als Notiz speichern
      </Button>
      {create.isError && (
        <span className="text-small text-destructive" role="alert">
          {describeError(create.error)}
        </span>
      )}
    </div>
  );
}
