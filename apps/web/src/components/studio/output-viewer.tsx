import { STUDIO_KIND, type StudioOutput } from '@nlm/shared';
import { ChevronRight, Trash2 } from 'lucide-react';

import { FlashcardsView } from '@/components/studio/flashcards-view';
import { MindmapView } from '@/components/studio/mindmap-view';
import { QuizView } from '@/components/studio/quiz-view';
import { ReportView } from '@/components/studio/report-view';
import { describeOutput, KIND_LABEL } from '@/components/studio/studio-labels';
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
      <nav
        aria-label="Pfad"
        className="flex h-10 w-fit shrink-0 items-center gap-1 pl-3 text-ui wide:-mt-10"
      >
        <button
          type="button"
          aria-label="Zurück zum Studio"
          onClick={onBack}
          className="rounded-md hover:underline"
        >
          Studio
        </button>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">{KIND_LABEL[output.kind]}</span>
      </nav>
      <div className="flex items-start gap-2 pt-3 pr-1 pl-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[1.375rem] leading-9">{output.title}</h3>
          <p className="truncate text-small text-muted-foreground">{describeOutput(output)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ausgabe löschen"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-3">
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
