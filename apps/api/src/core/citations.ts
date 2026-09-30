import type { Answer } from '@nlm/shared';

export interface SanitizedAnswer {
  /** Only statements that keep at least one citation from the context, with valid IDs only. */
  answer: Answer;
  /** Text of the statements that lost every citation. The caller decides how to react. */
  droppedStatements: string[];
  /** Citations removed because their ID was not part of the context sent to the model. */
  strippedCitations: number;
}

/**
 * Enforces the citation contract: a statement may cite only chunks that were in the context of the
 * request. Unknown IDs are stripped, statements without a valid citation are dropped.
 */
export function sanitizeAnswer(
  answer: Answer,
  contextChunkIds: readonly string[]
): SanitizedAnswer {
  const context = new Set(contextChunkIds);
  const statements: Answer['statements'] = [];
  const droppedStatements: string[] = [];
  let strippedCitations = 0;

  for (const statement of answer.statements) {
    const unique = [...new Set(statement.chunkIds)];
    const valid = unique.filter((id) => context.has(id));
    strippedCitations += unique.length - valid.length;
    if (valid.length > 0) {
      statements.push({ text: statement.text, chunkIds: valid });
    } else {
      droppedStatements.push(statement.text);
    }
  }

  return { answer: { statements }, droppedStatements, strippedCitations };
}
