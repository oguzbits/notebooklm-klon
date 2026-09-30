import { STUDIO_KIND, type StudioOutput } from '@nlm/shared';
import { ArrowLeft, Trash2 } from 'lucide-react';

import { FlashcardsView } from '@/components/studio/flashcards-view';
import { MindmapView } from '@/components/studio/mindmap-view';
import { QuizView } from '@/components/studio/quiz-view';
import { ReportView } from '@/components/studio/report-view';
import { describeOutput } from '@/components/studio/studio-labels';
import { Button } from '@/components/ui/button';

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-3 pb-2">
        <Button variant="ghost" size="icon-sm" aria-label="Zurück zum Studio" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {describeOutput(output)}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ausgabe löschen"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
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
      </div>
    </div>
  );
}
