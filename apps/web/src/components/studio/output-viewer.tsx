import { STUDIO_KIND, type StudioFeedback, type StudioOutput } from '@nlm/shared';
import { useState } from 'react';

import { FlashcardsView } from '@/components/studio/flashcards-view';
import { MindmapView } from '@/components/studio/mindmap-view';
import { QuizView } from '@/components/studio/quiz-view';
import { ReportView } from '@/components/studio/report-view';
import { ViewerFrame } from '@/components/studio/viewer-frame';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateStudioOutput } from '@/hooks/use-studio';
import { describeError } from '@/lib/messages';
import { reportToHtml, reportToText } from '@/lib/report-export';

/** One output in full, in place of the list: its frame, and its content as the kind needs it. */
export function OutputViewer({
  notebookId,
  output,
  deleting,
  onDelete,
  onOpenCitation,
  onAsk,
}: {
  notebookId: string;
  output: StudioOutput;
  deleting: boolean;
  onDelete: () => void;
  onOpenCitation: (chunkId: string) => void;
  /** Asks the chat a question; cards and quiz questions are explained there. */
  onAsk: (question: string) => void;
}) {
  const update = useUpdateStudioOutput(notebookId);
  const [enlarged, setEnlarged] = useState(false);
  const report = output.kind === STUDIO_KIND.REPORT;

  const content = () => {
    switch (output.kind) {
      case STUDIO_KIND.REPORT:
        return (
          <ReportView
            notebookId={notebookId}
            report={output.content}
            onOpenCitation={onOpenCitation}
          />
        );
      case STUDIO_KIND.FLASHCARDS:
        return (
          <FlashcardsView
            notebookId={notebookId}
            title={output.title}
            flashcards={output.content}
            onOpenCitation={onOpenCitation}
            onAsk={onAsk}
          />
        );
      case STUDIO_KIND.QUIZ:
        return (
          <QuizView
            notebookId={notebookId}
            quiz={output.content}
            onOpenCitation={onOpenCitation}
            onAsk={onAsk}
          />
        );
      case STUDIO_KIND.MINDMAP:
        return (
          <MindmapView
            notebookId={notebookId}
            title={output.title}
            mindmap={output.content}
            onOpenCitation={onOpenCitation}
          />
        );
    }
  };

  const change = (changes: { title: string } | { feedback: StudioFeedback | null }) =>
    update.mutate({ outputId: output.id, changes });

  return (
    <>
      <ViewerFrame
        notebookId={notebookId}
        title={output.title}
        titleLabel="Titel der Ausgabe"
        renaming={update.isPending && update.variables?.changes.title !== undefined}
        renameError={update.isError ? describeError(update.error) : null}
        onRename={(title, revert) =>
          update.mutate({ outputId: output.id, changes: { title } }, { onError: revert })
        }
        request={output.request}
        withPrompt={report}
        feedback={output.feedback}
        feedbackNoun={report ? 'Bericht' : 'Inhalt'}
        onFeedback={(feedback) => change({ feedback })}
        actions={
          report ? (
            <CopyButton
              label="Inhalt mit Formatierung kopieren"
              tooltip="Inhalt kopieren"
              write={() =>
                navigator.clipboard.write([
                  new ClipboardItem({
                    'text/html': new Blob([reportToHtml(output.content)], { type: 'text/html' }),
                    'text/plain': new Blob([reportToText(output.content)], { type: 'text/plain' }),
                  }),
                ])
              }
            />
          ) : undefined
        }
        onMaximize={report ? undefined : () => setEnlarged(true)}
        deleting={deleting}
        onDelete={onDelete}
      >
        {content()}
      </ViewerFrame>
      {!report && (
        <Dialog open={enlarged} onOpenChange={setEnlarged}>
          <DialogContent className="h-[90dvh] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{output.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Die Ausgabe in voller Größe. Die Nummern führen zu den Textstellen.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto">{content()}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
