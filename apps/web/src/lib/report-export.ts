import type { Report } from '@nlm/shared';

import { withoutMarkers } from '@/lib/plain-text';

const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** A statement as HTML: the **bold** words become `<strong>`, everything else is text. */
const statementHtml = (text: string) =>
  escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

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

/** The report with its formatting, for pasting into a document. */
export function reportToHtml(report: Report): string {
  return [
    `<h1>${escapeHtml(report.title)}</h1>`,
    ...report.sections.flatMap((section) => [
      `<h2>${escapeHtml(section.heading)}</h2>`,
      `<p>${statementHtml(paragraph(section.statements))}</p>`,
    ]),
  ].join('');
}
