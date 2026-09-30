import type { Report } from '@nlm/shared';

import { AnswerView } from '@/components/chat/message-view';

/** A report: a heading per section, the statements under it with the chips of their passages. */
export function ReportView({
  notebookId,
  report,
  onOpenCitation,
}: {
  notebookId: string;
  report: Report;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <article className="flex flex-col gap-5">
      <h3 className="text-xl leading-tight font-medium">{report.title}</h3>
      {report.sections.map((section, index) => (
        <section key={index} className="flex flex-col gap-1.5">
          <h4 className="text-base font-medium">{section.heading}</h4>
          <div className="text-sm">
            <AnswerView
              notebookId={notebookId}
              statements={section.statements}
              finished
              onOpenCitation={onOpenCitation}
            />
          </div>
        </section>
      ))}
    </article>
  );
}
