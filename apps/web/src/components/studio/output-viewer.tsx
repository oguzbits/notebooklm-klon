import { STUDIO_KIND, type StudioOutput } from '@nlm/shared';

import { FlashcardsView } from '@/components/studio/flashcards-view';
import { MindmapView } from '@/components/studio/mindmap-view';
import { QuizView } from '@/components/studio/quiz-view';
import { ReportView } from '@/components/studio/report-view';
import { describeOutput } from '@/components/studio/studio-labels';
import { ViewerFrame } from '@/components/studio/viewer-frame';

/** One output in full, in place of the Studio list. */
export function OutputViewer({
  notebookId,
  output,
  deleting,
  onDelete,
  onOpenCitation,
}: {
  notebookId: string;
  output: StudioOutput;
  deleting: boolean;
  onDelete: () => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <ViewerFrame
      title={output.title}
      subtitle={describeOutput(output)}
      deleteLabel="Löschen"
      deleting={deleting}
      onDelete={onDelete}
    >
      {output.kind === STUDIO_KIND.REPORT && (
        <ReportView
          notebookId={notebookId}
          report={output.content}
          onOpenCitation={onOpenCitation}
        />
      )}
      {output.kind === STUDIO_KIND.FLASHCARDS && (
        <FlashcardsView
          notebookId={notebookId}
          flashcards={output.content}
          onOpenCitation={onOpenCitation}
        />
      )}
      {output.kind === STUDIO_KIND.QUIZ && (
        <QuizView notebookId={notebookId} quiz={output.content} onOpenCitation={onOpenCitation} />
      )}
      {output.kind === STUDIO_KIND.MINDMAP && (
        <MindmapView
          notebookId={notebookId}
          mindmap={output.content}
          onOpenCitation={onOpenCitation}
        />
      )}
    </ViewerFrame>
  );
}
