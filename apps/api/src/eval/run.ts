import { type ApiErrorCode, CHAT_EVENT } from '@nlm/shared';

import { answerQuestion, type ChatPorts, prepareAnswer } from '../chat/answer';
import { LIMITS } from '../config/limits';
import type { EvalQuestion } from './dataset';
import {
  type CitedStatement,
  type RetrievalScore,
  scoreRequiredFacts,
  scoreRetrieval,
} from './scorers';

/** What a run needs from the outside: the search, the embedding and the model. */
export type EvalPorts = Omit<ChatPorts, 'selectedSourceIds'>;

export interface EvalScope {
  userId: string;
  notebookId: string;
  sourceIds: string[];
}

export interface QuestionResult {
  id: string;
  language: EvalQuestion['language'];
  retrieval: RetrievalScore;
  /** The statements that reached the user: checked, with real chunk IDs. */
  statements: CitedStatement[];
  answer: string;
  /** Statements the model wrote without a valid citation, removed by the server. */
  droppedStatements: number;
  /** Citations of passages the model was not shown, removed by the server. */
  strippedCitations: number;
  /** Share of the required facts that the answer states. */
  factsInAnswer: number | null;
  /** Share of the required facts that stand in the passages the answer cites. */
  factsInCitedChunks: number | null;
  failure: ApiErrorCode | null;
  firstStatementMs: number | null;
  totalMs: number;
}

export interface EvalSummary {
  questions: number;
  retrievalHitRate: number | null;
  meanHitRank: number | null;
  factsInAnswer: number | null;
  factsInCitedChunks: number | null;
  droppedStatements: number;
  strippedCitations: number;
  failures: number;
  medianFirstStatementMs: number | null;
}

/**
 * Asks one golden question through the same code path as the chat (search, context, model, citation
 * check) and scores what came out. The retrieval is scored on the passages the model was shown.
 */
export async function runQuestion(
  question: EvalQuestion,
  scope: EvalScope,
  ports: EvalPorts,
  options: { topK?: number; now?: () => number } = {}
): Promise<QuestionResult> {
  const now = options.now ?? Date.now;
  let retrieved: { id: string; text: string }[] = [];
  const chatPorts: ChatPorts = {
    ...ports,
    selectedSourceIds: async () => scope.sourceIds,
    search: async (request) => {
      retrieved = await ports.search(request);
      return retrieved;
    },
  };

  const started = now();
  const prepared = await prepareAnswer({ ...scope, question: question.question }, chatPorts);
  const statements: CitedStatement[] = [];
  let droppedStatements = 0;
  let strippedCitations = 0;
  let failure: ApiErrorCode | null = null;
  let firstStatementMs: number | null = null;

  for await (const event of answerQuestion(prepared, chatPorts)) {
    if (event.type === CHAT_EVENT.STATEMENT) {
      firstStatementMs ??= now() - started;
      statements.push({ text: event.text, chunkIds: event.chunkIds });
    } else if (event.type === CHAT_EVENT.DONE) {
      droppedStatements = event.droppedStatements;
      strippedCitations = event.strippedCitations;
    } else {
      failure = event.code;
    }
  }

  const textById = new Map(retrieved.map((chunk) => [chunk.id, chunk.text]));
  const citedText = statements
    .flatMap((statement) => statement.chunkIds)
    .map((id) => textById.get(id) ?? '')
    .join('\n');
  const answer = statements.map((statement) => statement.text).join(' ');

  return {
    id: question.id,
    language: question.language,
    retrieval: scoreRetrieval(
      retrieved,
      question.expectedAnchors.map((anchor) => anchor.text),
      options.topK ?? LIMITS.CHAT_CONTEXT_CHUNKS
    ),
    statements,
    answer,
    droppedStatements,
    strippedCitations,
    factsInAnswer: scoreRequiredFacts(answer, question.requiredFacts),
    factsInCitedChunks: scoreRequiredFacts(citedText, question.requiredFacts),
    failure,
    firstStatementMs,
    totalMs: now() - started,
  };
}

/** The mean of the values that apply. A question where a ratio does not apply is left out. */
function mean(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0) / present.length;
}

function median(values: (number | null)[]): number | null {
  const sorted = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return null;
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

export function summarize(results: QuestionResult[]): EvalSummary {
  return {
    questions: results.length,
    retrievalHitRate: mean(results.map((result) => (result.retrieval.hit ? 1 : 0))),
    meanHitRank: mean(results.map((result) => result.retrieval.rank)),
    factsInAnswer: mean(results.map((result) => result.factsInAnswer)),
    factsInCitedChunks: mean(results.map((result) => result.factsInCitedChunks)),
    droppedStatements: results.reduce((sum, result) => sum + result.droppedStatements, 0),
    strippedCitations: results.reduce((sum, result) => sum + result.strippedCitations, 0),
    failures: results.filter((result) => result.failure !== null).length,
    medianFirstStatementMs: median(results.map((result) => result.firstStatementMs)),
  };
}
