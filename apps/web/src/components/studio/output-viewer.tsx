import { STUDIO_KIND, type StudioOutput } from '@nlm/shared';

import { FlashcardsView } from '@/components/studio/flashcards-view';
import { MindmapView } from '@/components/studio/mindmap-view';
import { QuizView } from '@/components/studio/quiz-view';
import { ReportView } from '@/components/studio/report-view';
import { describeOutput, KIND_LABEL } from '@/components/studio/studio-labels';
import { ViewerFrame } from '@/components/studio/viewer-frame';

/** One output in full, in place of the Studio list. */
export function OutputViewer({
  notebookId,
  output,
  deleting,
  onBack,
  onDelete,
  onOpenCitation,
}: {
  notebookId: string;
  output: StudioOutput;
  deleting: boolean;
  onBack: () => void;
  onDelete: () => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <ViewerFrame
      crumb={KIND_LABEL[output.kind]}
      title={output.title}
      subtitle={describeOutput(output)}
      deleteLabel="Ausgabe löschen"
      deleting={deleting}
      onBack={onBack}
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
