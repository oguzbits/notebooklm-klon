import type { WrittenNote } from '@nlm/shared';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { RotateCw } from 'lucide-react';

import { noteExtensions } from '@/components/studio/note-extensions';
import { NoteFrame } from '@/components/studio/note-frame';
import { NoteToolbar } from '@/components/studio/note-toolbar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNoteAutosave } from '@/hooks/use-note-autosave';
import { describeError } from '@/lib/messages';
import { SAVE_STATE, type SaveEvent } from '@/lib/save-queue';

const MARKDOWN = 'text/markdown';

/** The text of the editor as Markdown, without the empty line the editor keeps at its end. */
const markdownOf = (editor: Editor) => editor.getMarkdown().trimEnd();

/** A failure to save: why, and a way to try again. */
function SaveProblem({ event, onRetry }: { event: SaveEvent | null; onRetry: () => void }) {
  if (event?.state !== SAVE_STATE.FAILED) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-2">
        <p>Die Notiz konnte nicht gespeichert werden. {describeError(event.error)}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw />
          Erneut versuchen
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** A quiet word on saving, in a live region so it is read out. */
function SaveNote({ event }: { event: SaveEvent | null }) {
  return (
    <p role="status" className="min-h-8 content-center text-small text-muted-foreground">
      {event?.state === SAVE_STATE.SAVING && 'Speichert …'}
      {event?.state === SAVE_STATE.SAVED && 'Gespeichert'}
    </p>
  );
}

/**
 * A note of the reader: the editor with its tools, saved as it is typed. The editor owns the text
 * while the note is open (it starts from the saved text and is not reset by what comes back), and
 * what is left unsaved goes out when the note is closed.
 */
export function WrittenNoteView({
  notebookId,
  note,
  deleting,
  onDelete,
}: {
  notebookId: string;
  note: WrittenNote;
  deleting: boolean;
  onDelete: () => void;
}) {
  const autosave = useNoteAutosave(notebookId, note.id);
  const editor = useEditor({
    extensions: noteExtensions,
    content: note.body,
    contentType: 'markdown',
    // A new, empty note is for writing: the cursor is already in it, like in the original.
    autofocus: note.body === '' ? 'start' : false,
    editorProps: {
      attributes: {
        class: 'source-text note-editor',
        // Tiptap does not put the role on the element, and a label needs one to be read out.
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Text der Notiz',
      },
    },
    onUpdate: ({ editor: current }) => autosave.push(markdownOf(current)),
  });
  const empty = useEditorState({ editor, selector: ({ editor: current }) => current.isEmpty });

  return (
    <NoteFrame
      notebookId={notebookId}
      note={note}
      deleting={deleting}
      onDelete={onDelete}
      toolbar={<NoteToolbar editor={editor} />}
      getSourceText={() => markdownOf(editor)}
      getMarkdown={() => markdownOf(editor)}
      sourceType={MARKDOWN}
      sourceDisabled={empty}
      problem={<SaveProblem event={autosave.event} onRetry={() => void autosave.flush()} />}
      footerNote={<SaveNote event={autosave.event} />}
    >
      <EditorContent editor={editor} className="h-full" />
    </NoteFrame>
  );
}
