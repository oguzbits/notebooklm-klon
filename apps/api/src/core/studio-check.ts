import type { DataTable, Flashcards, Mindmap, Quiz, Report } from '@nlm/shared';

import type { ChatContext } from './chat-context';

/** Labels the model cited, as real chunk IDs. Labels that were never shown are left out. */
const resolve = (labels: readonly string[], context: ChatContext): string[] => [
  ...new Set(labels.flatMap((label) => context.idByLabel.get(label) ?? [])),
];

/**
 * Keeps what has a valid citation and counts the rest. This is the citation contract of the chat,
 * applied to every part of a generated output.
 */
export function checked<T extends { chunkIds: string[] }>(
  items: readonly T[],
  context: ChatContext
): { kept: T[]; dropped: number } {
  const kept = items.flatMap((item) => {
    const chunkIds = resolve(item.chunkIds, context);
    return chunkIds.length > 0 ? [{ ...item, chunkIds }] : [];
  });
  return { kept, dropped: items.length - kept.length };
}

export function checkReport(report: Report, context: ChatContext) {
  let dropped = 0;
  const sections = report.sections.flatMap((section) => {
    const result = checked(section.statements, context);
    dropped += result.dropped;
    return result.kept.length > 0 ? [{ heading: section.heading, statements: result.kept }] : [];
  });
  return { content: { title: report.title, sections }, dropped, size: sections.length };
}

export function checkFlashcards(flashcards: Flashcards, context: ChatContext) {
  const { kept, dropped } = checked(flashcards.cards, context);
  return { content: { cards: kept }, dropped, size: kept.length };
}

export function checkQuiz(quiz: Quiz, context: ChatContext) {
  const { kept, dropped } = checked(quiz.questions, context);
  return { content: { questions: kept }, dropped, size: kept.length };
}

export function checkMindmap(mindmap: Mindmap, context: ChatContext) {
  let dropped = 0;
  const branches = checked(mindmap.branches, context);
  dropped += branches.dropped;
  const kept = branches.kept.map((branch) => {
    const twigs = checked(branch.children, context);
    dropped += twigs.dropped;
    return {
      ...branch,
      children: twigs.kept.map((twig) => {
        const leaves = checked(twig.children, context);
        dropped += leaves.dropped;
        return { ...twig, children: leaves.kept };
      }),
    };
  });
  return { content: { title: mindmap.title, branches: kept }, dropped, size: kept.length };
}

/**
 * A table keeps a row only if its first cell and at least one more cell hold a supported value, so
 * a row is never just a name. A cell without a valid citation is emptied and the row kept, so the
 * values stay under their columns. A row with the wrong number of cells cannot be read and is dropped.
 */
export function checkDataTable(table: DataTable, context: ChatContext) {
  let dropped = 0;
  const rows = table.rows.flatMap((row) => {
    if (row.cells.length !== table.columns.length) {
      dropped += 1;
      return [];
    }
    const cells = row.cells.map((cell) => {
      const [supported] = checked([cell], context).kept;
      return supported !== undefined && supported.text !== ''
        ? supported
        : { text: '', chunkIds: [] };
    });
    const filled = cells.filter((cell) => cell.text !== '').length;
    if (cells[0]?.text === '' || filled < 2) {
      dropped += 1;
      return [];
    }
    dropped += row.cells.filter((cell) => cell.text !== '').length - filled;
    return [{ cells }];
  });
  return {
    content: { title: table.title, columns: table.columns, rows },
    dropped,
    size: rows.length,
  };
}
