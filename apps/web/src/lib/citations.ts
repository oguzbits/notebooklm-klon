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
