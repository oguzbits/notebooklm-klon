import { type AnswerNote, type Note, NOTE_KIND } from '@nlm/shared';
import { lazy, Suspense } from 'react';

import { AnswerView } from '@/components/chat/message-view';
import { NoteEditorSkeleton } from '@/components/skeletons';
import { NoteFrame } from '@/components/studio/note-frame';
import { noteTitle } from '@/components/studio/studio-labels';
import { answerToMarkdown } from '@/lib/markdown-export';
import { withoutMarkers } from '@/lib/plain-text';

const PLAIN_TEXT = 'text/plain';

// The editor is more than half of what the rest of the page weighs, and only a note of the reader
// needs it, so it is fetched when the first such note opens.
const WrittenNoteView = lazy(async () => ({
  default: (await import('@/components/studio/written-note')).WrittenNoteView,
}));

/**
 * A saved answer in full: its chips lead to the passages like in the chat. The text cannot be
 * changed, because a chip would then vouch for words that are no longer there. It can be named.
 */
function AnswerNoteView({
  notebookId,
  note,
  deleting,
  onDelete,
  onOpenCitation,
}: {
  notebookId: string;
  note: AnswerNote;
  deleting: boolean;
  onDelete: () => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <NoteFrame
      notebookId={notebookId}
      note={note}
      deleting={deleting}
      onDelete={onDelete}
      getMarkdown={() => answerToMarkdown(noteTitle(note), note.statements)}
      sourceType={PLAIN_TEXT}
      getSourceText={() =>
        note.statements.map((statement) => withoutMarkers(statement.text)).join(' ')
      }
    >
      <AnswerView
        notebookId={notebookId}
        statements={note.statements}
        finished
        onOpenCitation={onOpenCitation}
      />
    </NoteFrame>
  );
}

/**
 * One note in full, in place of the Studio list: a saved answer, or a note of the reader with the
 * editor. "Als Quelle festlegen" puts its text among the sources.
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
  if (note.kind === NOTE_KIND.WRITTEN) {
    return (
      <Suspense fallback={<NoteEditorSkeleton />}>
        <WrittenNoteView
          notebookId={notebookId}
          note={note}
          deleting={deleting}
          onDelete={onDelete}
        />
      </Suspense>
    );
  }
  return (
    <AnswerNoteView
      notebookId={notebookId}
      note={note}
      deleting={deleting}
      onDelete={onDelete}
      onOpenCitation={onOpenCitation}
    />
  );
}
