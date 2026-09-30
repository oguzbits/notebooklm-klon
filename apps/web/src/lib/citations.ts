import type { AnswerStatement } from '@nlm/shared';

export interface NumberedCitation {
  chunkId: string;
  number: number;
}

export interface NumberedStatement {
  text: string;
  citations: NumberedCitation[];
}

/**
 * Numbers the cited passages of one answer: 1 for the first passage that appears, 2 for the next
 * new one, and so on. The same passage keeps its number wherever it is cited again.
 */
export function numberCitations(statements: AnswerStatement[]): NumberedStatement[] {
  const numbers = new Map<string, number>();
  return statements.map((statement) => ({
    text: statement.text,
    citations: [...new Set(statement.chunkIds)].map((chunkId) => {
      const number = numbers.get(chunkId) ?? numbers.size + 1;
      numbers.set(chunkId, number);
      return { chunkId, number };
    }),
  }));
}

/** Cuts a source text into the part before a cited passage, the passage, and the rest. */
export function splitAtHighlight(text: string, start: number | null, end: number | null) {
  if (start === null || end === null || start >= text.length) {
    return { before: text, highlight: '', after: '' };
  }
  const from = Math.max(0, start);
  const to = Math.min(text.length, Math.max(from, end));
  return { before: text.slice(0, from), highlight: text.slice(from, to), after: text.slice(to) };
}
