import { NotebookText, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AnswerView } from '@/components/chat/message-view';
import { QueryBoundary } from '@/components/query-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteNote, useNotes } from '@/hooks/use-notes';
import { describeError } from '@/lib/messages';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

/** Saved answers. The chips in a note lead to the passages like they do in the chat. */
export function NotesPanel({
  notebookId,
  onOpenCitation,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
}) {
  const notes = useNotes(notebookId);
  const remove = useDeleteNote(notebookId);
  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <QueryBoundary
        query={notes}
        isEmpty={(list) => list.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <NotebookText className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Noch keine Notizen</p>
            <p className="text-xs text-muted-foreground">
              Speichere eine Antwort mit „Als Notiz speichern“, um sie hier zu behalten.
            </p>
          </div>
        }
      >
        {(list) => (
          <ul className="flex flex-col gap-3">
            {list.map((note) => (
              <li key={note.id} className="rounded-lg border bg-background p-3 text-sm">
                <AnswerView
                  notebookId={notebookId}
                  statements={note.statements}
                  finished
                  onOpenCitation={onOpenCitation}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {dateFormat.format(new Date(note.createdAt))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Notiz löschen"
                    onClick={() => setToDelete(note.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      {remove.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(remove.error)}</AlertDescription>
        </Alert>
      )}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Notiz wird gelöscht. Die Antwort im Chat bleibt erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
