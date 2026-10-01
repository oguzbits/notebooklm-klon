import type { Report } from '@nlm/shared';

import { withoutMarkers } from '@/lib/plain-text';

const paragraph = (statements: Report['sections'][number]['statements']) =>
  statements.map((statement) => statement.text).join(' ');

/** The report as plain text: the title, then each heading with its statements as one paragraph. */
export function reportToText(report: Report): string {
  return [
    report.title,
    ...report.sections.flatMap((section) => [
      '',
      section.heading,
      withoutMarkers(paragraph(section.statements)),
    ]),
  ].join('\n');
}
