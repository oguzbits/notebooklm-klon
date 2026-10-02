import { type AnswerStatement, CHAT_ROLE, type ChatMessage, type Report } from '@nlm/shared';

import { download } from './download';

const MARKDOWN_TYPE = 'text/markdown;charset=utf-8';

// The statements of a section or an answer are one paragraph; the **bold** words are Markdown already.
const paragraph = (statements: readonly AnswerStatement[]) =>
  statements.map((statement) => statement.text).join(' ');

/** The report as Markdown: a heading for the title and one for each section. Citations stay out, their numbers mean nothing outside the notebook. */
export function reportToMarkdown(report: Report): string {
  const sections = report.sections.map(
    (section) => `## ${section.heading}\n\n${paragraph(section.statements)}\n`
  );
  return [`# ${report.title}\n`, ...sections].join('\n');
}

/** A saved answer as Markdown, under its title. */
export function answerToMarkdown(title: string, statements: readonly AnswerStatement[]): string {
  return `# ${title}\n\n${paragraph(statements)}\n`;
}

/** The file name for a title: a path separator would make the browser change the name. */
/** The conversation in order, each question and each answer under its own heading. */
export function chatToMarkdown(title: string, messages: readonly ChatMessage[]): string {
  const turns = messages.map((message) =>
    message.role === CHAT_ROLE.USER
      ? `### Frage\n\n${message.text}\n`
      : `### Antwort\n\n${paragraph(message.statements)}\n`
  );
  return [`# ${title}\n`, ...turns].join('\n');
}

export const markdownFileName = (title: string) => `${title.replace(/[\\/]/g, '-')}.md`;

/** Hands the text to the browser as a Markdown file named after the title. */
export function downloadMarkdown(title: string, text: string): void {
  download(markdownFileName(title), new Blob([text], { type: MARKDOWN_TYPE }));
}
