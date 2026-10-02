import { type Report, STUDIO_KIND, type StudioOutput } from '@nlm/shared';
import { type ReactNode, useState } from 'react';

import { DataTableView } from '@/components/studio/data-table-view';
import { DownloadMarkdownButton } from '@/components/studio/download-markdown-button';
import { FlashcardsView } from '@/components/studio/flashcards-view';
import { MindmapView } from '@/components/studio/mindmap-view';
import { QuizView } from '@/components/studio/quiz-view';
import { reportHtml } from '@/components/studio/report-html';
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
import { reportToMarkdown } from '@/lib/markdown-export';
import { describeError } from '@/lib/messages';
import { reportToText } from '@/lib/report-export';

/** The content of an output as its kind needs it: a report, cards, a quiz, a mind map or a data table. */
function OutputContent({
  notebookId,
  output,
  onOpenCitation,
  onAsk,
}: {
  notebookId: string;
  output: StudioOutput;
  onOpenCitation: (chunkId: string) => void;
  onAsk: (question: string) => void;
}) {
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
    case STUDIO_KIND.DATA_TABLE:
      return (
        <DataTableView
          notebookId={notebookId}
          table={output.content}
          onOpenCitation={onOpenCitation}
        />
      );
  }
}

/** Copies a report with its formatting and as plain text, so a document or a text field takes what it prefers. */
function CopyReportButton({ report }: { report: Report }) {
  return (
    <CopyButton
      label="Inhalt mit Formatierung kopieren"
      tooltip="Inhalt kopieren"
      write={() =>
        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': reportHtml(report).then((html) => new Blob([html], { type: 'text/html' })),
            'text/plain': new Blob([reportToText(report)], { type: 'text/plain' }),
          }),
        ])
      }
    />
  );
}

/** What a report can be taken away with: copied for another program, or saved as a file. */
function ReportActions({ title, report }: { title: string; report: Report }) {
  return (
    <>
      <CopyReportButton report={report} />
      <DownloadMarkdownButton title={title} getMarkdown={() => reportToMarkdown(report)} />
    </>
  );
}

/** The output in a dialog of its own, as large as the window allows. */
function EnlargedOutput({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90dvh] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Die Ausgabe in voller Größe. Die Nummern führen zu den Textstellen.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

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
  const content = (
    <OutputContent
      notebookId={notebookId}
      output={output}
      onOpenCitation={onOpenCitation}
      onAsk={onAsk}
    />
  );

  return (
    <>
      <ViewerFrame
        notebookId={notebookId}
        title={{
          text: output.title,
          label: 'Titel der Ausgabe',
          saving: update.isPending && update.variables?.changes.title !== undefined,
          error: update.isError ? describeError(update.error) : null,
          onSave: (title, revert) =>
            update.mutate({ outputId: output.id, changes: { title } }, { onError: revert }),
        }}
        prompt={{ request: output.request, withPrompt: report }}
        feedback={{
          value: output.feedback,
          noun: report ? 'Bericht' : 'Inhalt',
          onChange: (feedback) => update.mutate({ outputId: output.id, changes: { feedback } }),
        }}
        actions={
          report ? <ReportActions title={output.title} report={output.content} /> : undefined
        }
        onMaximize={report ? undefined : () => setEnlarged(true)}
        deletion={{ pending: deleting, onDelete }}
      >
        {content}
      </ViewerFrame>
      {!report && (
        <EnlargedOutput title={output.title} open={enlarged} onOpenChange={setEnlarged}>
          {content}
        </EnlargedOutput>
      )}
    </>
  );
}
