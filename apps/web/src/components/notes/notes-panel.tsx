import type { Note } from '@nlm/shared';
import { FilePlus2, NotebookText, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AnswerView } from '@/components/chat/message-view';
import { QueryBoundary } from '@/components/query-boundary';
import { OutputRowsSkeleton } from '@/components/skeletons';
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
import { useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

/** Saved answers. The chips in a note lead to the passages like they do in the chat. */
export function NotesSection({
  notebookId,
  onOpenCitation,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
}) {
  const notes = useNotes(notebookId);
  const remove = useDeleteNote(notebookId);
  const upload = useUploadFile(notebookId);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  /** A note becomes a source: its text goes up as a text file, like pasted text does. */
  const addAsSource = (note: Note) =>
    upload.mutate(
      new File(
        [note.statements.map((statement) => statement.text).join(' ')],
        `Notiz vom ${dateFormat.format(new Date(note.createdAt))}.txt`,
        { type: 'text/plain' }
      ),
      { onSuccess: () => setAdded((current) => new Set(current).add(note.id)) }
    );

  return (
    <section aria-labelledby="notes-heading" className="flex flex-col gap-3">
      <h3 id="notes-heading" className="px-1 text-ui font-title">
        Notizen
      </h3>
      <QueryBoundary
        query={notes}
        loading={<OutputRowsSkeleton rows={1} />}
        isEmpty={(list) => list.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <NotebookText className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-ui font-title">Noch keine Notizen</p>
            <p className="text-small text-muted-foreground">
              Speichere eine Antwort mit „Als Notiz speichern“, um sie hier zu behalten.
            </p>
          </div>
        }
      >
        {(list) => (
          <ul className="flex flex-col gap-3">
            {list.map((note) => (
              <li key={note.id} className="rounded-xl bg-secondary p-4 text-ui">
                <AnswerView
                  notebookId={notebookId}
                  statements={note.statements}
                  finished
                  onOpenCitation={onOpenCitation}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-small text-muted-foreground">
                    {dateFormat.format(new Date(note.createdAt))}
                  </span>
                  <div className="flex items-center gap-1">
                    {added.has(note.id) ? (
                      <span className="text-small text-muted-foreground">
                        Als Quelle hinzugefügt
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label="Notiz als Quelle hinzufügen"
                        disabled={upload.isPending}
                        onClick={() => addAsSource(note)}
                      >
                        <FilePlus2 />
                        Als Quelle
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Notiz löschen"
                      tooltip="Löschen"
                      onClick={() => setToDelete(note.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      {(remove.isError || upload.isError) && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(remove.error ?? upload.error)}</AlertDescription>
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
    </section>
  );
}
