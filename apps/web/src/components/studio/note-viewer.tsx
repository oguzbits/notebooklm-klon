import type { Note } from '@nlm/shared';
import { Check, EllipsisVertical, FilePlus2, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { AnswerView } from '@/components/chat/message-view';
import { noteTitle } from '@/components/studio/studio-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';
import { withoutMarkers } from '@/lib/plain-text';
import { relativeTime } from '@/lib/relative-time';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

/** The frame of one note in full: its title with the menu that deletes it, the text, a footer. */
function NoteFrame({
  title,
  subtitle,
  deleting,
  onDelete,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  deleting: boolean;
  onDelete: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 pt-3 pr-1 pl-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[1.375rem] leading-9">{title}</h3>
          <p className="truncate text-small text-muted-foreground">{subtitle}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Weitere Aktionen"
              tooltip="Mehr"
              disabled={deleting}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={deleting} onSelect={onDelete}>
              <Trash2 aria-hidden />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-3">{children}</div>
      <div className="shrink-0 px-3 pb-1">{footer}</div>
    </div>
  );
}

/**
 * One saved answer in full, in place of the Studio list. The chips in it lead to the passages like
 * in the chat, and "Als Quelle festlegen" puts its text among the sources.
 */
export function NoteViewer({
  notebookId,
  note,
  deleting,
  onDelete,
  onOpenCitation,
}: {
  notebookId: string;
  note: Note;
  deleting: boolean;
  onDelete: () => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  const upload = useUploadFile(notebookId);
  const [added, setAdded] = useState(false);

  /** The text of the note goes up as a text file, like pasted text does. */
  const addAsSource = () =>
    upload.mutate(
      new File(
        [note.statements.map((statement) => withoutMarkers(statement.text)).join(' ')],
        `Notiz vom ${dateFormat.format(new Date(note.createdAt))}.txt`,
        { type: 'text/plain' }
      ),
      { onSuccess: () => setAdded(true) }
    );

  return (
    <NoteFrame
      title="Notiz"
      subtitle={`Gespeichert ${relativeTime(note.createdAt)}`}
      deleting={deleting}
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
    </NoteFrame>
  );
}
