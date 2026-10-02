import { type Note, NOTE_LIMITS } from '@nlm/shared';
import { Check, FilePlus2, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { DownloadMarkdownButton } from '@/components/studio/download-markdown-button';
import { noteFileName, noteTitle } from '@/components/studio/studio-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EditableTitle } from '@/components/ui/editable-title';
import { useUpdateNote } from '@/hooks/use-notes';
import { useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

interface AddAsSourceProps {
  notebookId: string;
  fileName: string;
  type: string;
  /** The text as it is now, which for a note being written is newer than the saved one. */
  getText: () => string;
  disabled: boolean;
}

/** Puts the text of a note among the sources, as a file, like pasted text does. */
function AddAsSource({ notebookId, fileName, type, getText, disabled }: AddAsSourceProps) {
  const upload = useUploadFile(notebookId);
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <p className="flex h-9 items-center gap-2 px-2 text-ui text-muted-foreground">
        <Check className="size-5" aria-hidden />
        Als Quelle hinzugefügt
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      {upload.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(upload.error)}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || upload.isPending}
        onClick={() =>
          upload.mutate(new File([getText()], fileName, { type }), {
            onSuccess: () => setAdded(true),
          })
        }
      >
        <FilePlus2 />
        Als Quelle festlegen
      </Button>
    </div>
  );
}

interface NoteFrameProps {
  notebookId: string;
  note: Note;
  deleting: boolean;
  onDelete: () => void;
  toolbar?: ReactNode;
  getSourceText: () => string;
  /** The note as a Markdown file, as it is now. */
  getMarkdown: () => string;
  sourceType: string;
  /** True while there is nothing to make a source of. */
  sourceDisabled?: boolean;
  /** A failure to save, above the footer (only a note of the reader is saved as it is typed). */
  problem?: ReactNode;
  /** A quiet word on saving, at the right of "Als Quelle festlegen". */
  footerNote?: ReactNode;
  children: ReactNode;
}

/**
 * The frame of one note in full, like the original: its title as a field with the trash can, the
 * tools (for a note of the reader), the text, and "Als Quelle festlegen" with what is known about
 * saving. The path back lives in the header of the column.
 */
export function NoteFrame({
  notebookId,
  note,
  deleting,
  onDelete,
  toolbar,
  getSourceText,
  getMarkdown,
  sourceType,
  sourceDisabled = false,
  problem,
  footerNote,
  children,
}: NoteFrameProps) {
  const update = useUpdateNote(notebookId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[74px] shrink-0 items-center gap-1 pr-4 pl-2">
        <EditableTitle
          value={noteTitle(note)}
          label="Titel der Notiz"
          saving={update.isPending && update.variables?.changes.title !== undefined}
          error={update.isError ? describeError(update.error) : null}
          maxLength={NOTE_LIMITS.TITLE_CHARS}
          onSave={(title, revert) =>
            update.mutate({ noteId: note.id, changes: { title } }, { onError: revert })
          }
          className="h-10 px-2 text-[1.375rem] leading-9"
        />
        <DownloadMarkdownButton title={noteTitle(note)} getMarkdown={getMarkdown} size="icon-lg" />
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Notiz löschen"
          tooltip="Löschen"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      {toolbar ?? <div aria-hidden className="shrink-0 border-t border-border" />}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3">{children}</div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 pt-4 pb-3">
        {problem}
        <div className="flex items-start justify-between gap-3">
          <AddAsSource
            notebookId={notebookId}
            fileName={noteFileName(note)}
            type={sourceType}
            getText={getSourceText}
            disabled={sourceDisabled}
          />
          {footerNote}
        </div>
      </div>
    </div>
  );
}
