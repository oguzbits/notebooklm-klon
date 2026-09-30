import type { Note } from '@nlm/shared';
import { Check, FilePlus2 } from 'lucide-react';
import { useState } from 'react';

import { AnswerView } from '@/components/chat/message-view';
import { noteTitle } from '@/components/studio/studio-labels';
import { ViewerFrame } from '@/components/studio/viewer-frame';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';
import { relativeTime } from '@/lib/relative-time';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * One saved answer in full, in place of the Studio list. The chips in it lead to the passages like
 * in the chat, and "Als Quelle festlegen" puts its text among the sources.
 */
export function NoteViewer({
  notebookId,
  note,
  deleting,
  onBack,
  onDelete,
  onOpenCitation,
}: {
  notebookId: string;
  note: Note;
  deleting: boolean;
  onBack: () => void;
  onDelete: () => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  const upload = useUploadFile(notebookId);
  const [added, setAdded] = useState(false);

  /** The text of the note goes up as a text file, like pasted text does. */
  const addAsSource = () =>
    upload.mutate(
      new File(
        [note.statements.map((statement) => statement.text).join(' ')],
        `Notiz vom ${dateFormat.format(new Date(note.createdAt))}.txt`,
        { type: 'text/plain' }
      ),
      { onSuccess: () => setAdded(true) }
    );

  return (
    <ViewerFrame
      crumb="Notiz"
      title="Notiz"
      subtitle={`Gespeichert ${relativeTime(note.createdAt)}`}
      deleteLabel="Notiz löschen"
      deleting={deleting}
      onBack={onBack}
      onDelete={onDelete}
      footer={
        <div className="flex flex-col items-start gap-2">
          {upload.isError && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(upload.error)}</AlertDescription>
            </Alert>
          )}
          {added ? (
            <p className="flex h-9 items-center gap-2 px-2 text-ui text-muted-foreground">
              <Check className="size-5" aria-hidden />
              Als Quelle hinzugefügt
            </p>
          ) : (
            <Button variant="secondary" disabled={upload.isPending} onClick={addAsSource}>
              <FilePlus2 />
              Als Quelle festlegen
            </Button>
          )}
        </div>
      }
    >
      <p className="sr-only">{noteTitle(note)}</p>
      <AnswerView
        notebookId={notebookId}
        statements={note.statements}
        finished
        onOpenCitation={onOpenCitation}
      />
    </ViewerFrame>
  );
}
