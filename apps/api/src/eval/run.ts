import { type ApiErrorCode, CHAT_EVENT } from '@nlm/shared';

import {
  answerQuestion,
  type ChatPorts,
  type OmittedStatement,
  prepareAnswer,
} from '../chat/answer';
import { LIMITS } from '../config/limits';
import type { EvalQuestion } from './dataset';
import {
  type CitedStatement,
  countRepeatedStatements,
  findForbiddenFacts,
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
  answerable: boolean;
  /** Not scored for a question the sources cannot answer: there is nothing to find. */
  retrieval: RetrievalScore | null;
  /** The statements that reached the user: checked, with real chunk IDs. */
  statements: CitedStatement[];
  answer: string;
  /** Statements the model wrote without a valid citation, removed by the server. */
  droppedStatements: number;
  /** The statements the server left out, with the reason: why the count above is not zero. */
  omittedStatements: OmittedStatement[];
  /** Citations of passages the model was not shown, removed by the server. */
  strippedCitations: number;
  /** Share of the required facts that the answer states. */
  factsInAnswer: number | null;
  /** Share of the required facts that stand in the passages the answer cites. */
  factsInCitedChunks: number | null;
  /**
   * For an unanswerable question: the chat refused, meaning the server kept no statement (a refusal
   * has no citation, so it is the one thing the server removes on purpose). Null otherwise.
   */
  abstained: boolean | null;
  /** Pairs of kept statements that say the same thing. */
  repeatedStatements: number;
  /** Forbidden strings of the question that the answer contains. */
  forbiddenFacts: string[];
  answerWords: number;
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
  /** Share of the unanswerable questions the chat refused. */
  abstentionRate: number | null;
  repeatedStatements: number;
  forbiddenFacts: number;
  meanAnswerWords: number | null;
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
  const omittedStatements: OmittedStatement[] = [];
  const chatPorts: ChatPorts = {
    ...ports,
    onOmitted: (omitted) => omittedStatements.push(omitted),
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
    answerable: question.answerable,
    retrieval: question.answerable
      ? scoreRetrieval(
          retrieved,
          question.expectedAnchors.map((anchor) => anchor.text),
          options.topK ?? LIMITS.CHAT_CONTEXT_CHUNKS
        )
      : null,
    statements,
    answer,
    droppedStatements,
    omittedStatements,
    strippedCitations,
    factsInAnswer: scoreRequiredFacts(answer, question.requiredFacts),
    factsInCitedChunks: scoreRequiredFacts(citedText, question.requiredFacts),
    abstained: question.answerable ? null : failure === null && statements.length === 0,
    repeatedStatements: countRepeatedStatements(statements),
    forbiddenFacts: findForbiddenFacts(answer, question.forbiddenFacts),
    answerWords: answer.split(/\s+/).filter(Boolean).length,
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

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

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
    retrievalHitRate: mean(
      results.map((result) => (result.retrieval === null ? null : result.retrieval.hit ? 1 : 0))
    ),
    meanHitRank: mean(results.map((result) => result.retrieval?.rank ?? null)),
    factsInAnswer: mean(results.map((result) => result.factsInAnswer)),
    factsInCitedChunks: mean(results.map((result) => result.factsInCitedChunks)),
    abstentionRate: mean(
      results.map((result) => (result.abstained === null ? null : result.abstained ? 1 : 0))
    ),
    repeatedStatements: sum(results.map((result) => result.repeatedStatements)),
    forbiddenFacts: sum(results.map((result) => result.forbiddenFacts.length)),
    meanAnswerWords: mean(
      results.filter((result) => result.answerable).map((result) => result.answerWords)
    ),
    droppedStatements: results.reduce((sum, result) => sum + result.droppedStatements, 0),
    strippedCitations: results.reduce((sum, result) => sum + result.strippedCitations, 0),
    failures: results.filter((result) => result.failure !== null).length,
    medianFirstStatementMs: median(results.map((result) => result.firstStatementMs)),
  };
}
