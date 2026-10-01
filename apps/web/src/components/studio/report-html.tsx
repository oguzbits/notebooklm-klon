import type { Report } from '@nlm/shared';
import { Fragment } from 'react';

import { renderMarkup } from '@/lib/render-markup';

const BOLD = /\*\*(.+?)\*\*/g;

/** The statements of a section as one paragraph, the **bold** words as `<strong>`, the rest as text. */
function paragraphParts(statements: Report['sections'][number]['statements']) {
  // split() with one capture group puts the bold words at the odd places.
  return statements
    .map((statement) => statement.text)
    .join(' ')
    .split(BOLD)
    .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

/** The report with its formatting, for pasting into a document. */
function ReportHtml({ report }: { report: Report }) {
  return (
    <>
      <h1>{report.title}</h1>
      {report.sections.map((section) => (
        <Fragment key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{paragraphParts(section.statements)}</p>
        </Fragment>
      ))}
    </>
  );
}

export function reportHtml(report: Report): Promise<string> {
  return renderMarkup(<ReportHtml report={report} />);
}
