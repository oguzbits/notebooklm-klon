import {
  API_ERROR,
  CHAT_EVENT,
  type ChatConfig,
  type ChatEvent,
  DEFAULT_CHAT_CONFIG,
} from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import { GeminiError } from '../ai/gemini-error';
import { LIMITS } from '../config/limits';
import { buildChatContext, type ChatContext, resolveCitations } from '../core/chat-context';
import {
  buildRewriteMessage,
  type HistoryTurn,
  parseRewrite,
  REWRITE_JSON_SCHEMA,
  REWRITE_SYSTEM_PROMPT,
} from '../core/chat-history';
import { ANSWER_JSON_SCHEMA, buildUserMessage, chatSystemPrompt } from '../core/chat-prompt';
import { cleanFollowUps } from '../core/follow-ups';
import { findUnsupportedNumbers, repeatsStatement } from '../core/statement-check';
import { StatementStream } from '../core/statement-stream';
import { HTTP_STATUS } from '../http-status';

/** The user has no ready, selected source in this notebook, so there is nothing to answer from. */
export class NoSourcesSelectedError extends Error {
  constructor() {
    super('No source is selected.');
    this.name = 'NoSourcesSelectedError';
  }
}

/** Why a statement of the model did not reach the reader. */
export const OMISSION_REASON = {
  NOT_CITED: 'NOT_CITED',
  UNSUPPORTED_NUMBER: 'UNSUPPORTED_NUMBER',
  REPEATED: 'REPEATED',
} as const;

export type OmissionReason = (typeof OMISSION_REASON)[keyof typeof OMISSION_REASON];

/** A statement the server left out. Only for the eval report: it carries content, so it is never logged. */
export interface OmittedStatement {
  text: string;
  reason: OmissionReason;
  /** For UNSUPPORTED_NUMBER: the numbers no cited passage contains. */
  numbers?: string[];
}

export interface SearchRequest {
  userId: string;
  notebookId: string;
  sourceIds: string[];
  queryEmbedding: number[];
  queryText: string;
  limit: number;
}

/** What the answer flow needs from the outside. Fakes in tests, database and Gemini in production. */
export interface ChatPorts {
  /** Ready sources the user has selected in this notebook. */
  selectedSourceIds: (userId: string, notebookId: string) => Promise<string[]>;
  embedQuery: (text: string) => Promise<number[]>;
  search: (request: SearchRequest) => Promise<{ id: string; text: string }[]>;
  stream: (input: ChatInput) => AsyncIterable<string>;
  /** Called with an error that ended an answer. It is then also reported as an ERROR event. */
  onError: (error: unknown) => void;
  /** Called with each statement the server leaves out, so an eval can show what and why. */
  onOmitted?: (omitted: OmittedStatement) => void;
}

export interface PreparedAnswer {
  question: string;
  /** How many sources the question was searched in (the selected, ready ones). */
  sourcesSearched: number;
  context: ChatContext;
  config: ChatConfig;
  /** Earlier exchanges of the conversation; they only tell the model what the question refers to. */
  history: HistoryTurn[];
}

/**
 * A follow-up question like "und 2019?" says nothing to a search. The model turns it, with the
 * earlier turns, into one self-contained query. A failure throws: a search on the bare follow-up
 * would silently return passages for a different question.
 */
async function rewriteQuery(
  question: string,
  history: readonly HistoryTurn[],
  ports: ChatPorts
): Promise<string> {
  let reply = '';
  for await (const piece of ports.stream({
    system: REWRITE_SYSTEM_PROMPT,
    user: buildRewriteMessage(history, question),
    schema: REWRITE_JSON_SCHEMA,
  })) {
    reply += piece;
  }
  return parseRewrite(reply);
}

/**
 * Everything that can fail before an answer starts: which sources, the question's vector, the
 * search. Kept apart from streaming so the route can still answer with an HTTP status.
 */
export async function prepareAnswer(
  input: {
    userId: string;
    notebookId: string;
    question: string;
    config?: ChatConfig;
    history?: HistoryTurn[];
  },
  ports: ChatPorts
): Promise<PreparedAnswer> {
  const sourceIds = await ports.selectedSourceIds(input.userId, input.notebookId);
  if (sourceIds.length === 0) throw new NoSourcesSelectedError();

  const history = input.history ?? [];
  // Searched after the sources check: a notebook without a source never calls the model.
  const query =
    history.length === 0 ? input.question : await rewriteQuery(input.question, history, ports);
  const queryEmbedding = await ports.embedQuery(query);
  const chunks = await ports.search({
    userId: input.userId,
    notebookId: input.notebookId,
    sourceIds,
    queryEmbedding,
    queryText: query,
    limit: LIMITS.CHAT_CONTEXT_CHUNKS,
  });
  return {
    question: input.question,
    sourcesSearched: sourceIds.length,
    context: buildChatContext(chunks),
    config: input.config ?? DEFAULT_CHAT_CONFIG,
    history,
  };
}

/**
 * What happened to the statements of one answer: how many were kept, how many were left out
 * because their citation or a number in them is not backed by the context, and how many citations
 * were removed from the ones that stayed. A statement that only repeats a kept one is left out
 * silently: it says nothing wrong, it only says it twice.
 */
class AnswerTally {
  statements = 0;
  droppedStatements = 0;
  strippedCitations = 0;
  private readonly kept: string[] = [];

  constructor(
    private readonly context: ChatContext,
    private readonly question: string,
    private readonly onOmitted: (omitted: OmittedStatement) => void = () => {}
  ) {}

  /** The numbers of a statement that neither its cited passages nor the question contain. */
  private unsupportedNumbers(text: string, labels: readonly string[]): string[] {
    const evidence = labels.map((label) => this.context.textByLabel.get(label) ?? '');
    return findUnsupportedNumbers(text, [this.question, ...evidence].join('\n'));
  }

  /** The events of the statements that stay; the others are counted or left out. */
  *events(statements: readonly { text: string; chunkIds: string[] }[]): Generator<ChatEvent> {
    for (const statement of statements) {
      const result = resolveCitations({ statements: [statement] }, this.context);
      this.strippedCitations += result.strippedCitations;
      const [kept] = result.answer.statements;
      const cited = statement.chunkIds.filter((label) => this.context.idByLabel.has(label));
      if (!kept) {
        this.droppedStatements += 1;
        this.onOmitted({ text: statement.text, reason: OMISSION_REASON.NOT_CITED });
        continue;
      }
      const unsupported = this.unsupportedNumbers(kept.text, cited);
      if (unsupported.length > 0) {
        this.droppedStatements += 1;
        this.onOmitted({
          text: kept.text,
          reason: OMISSION_REASON.UNSUPPORTED_NUMBER,
          numbers: unsupported,
        });
        continue;
      }
      if (this.kept.some((text) => repeatsStatement(text, kept.text))) {
        this.onOmitted({ text: kept.text, reason: OMISSION_REASON.REPEATED });
        continue;
      }
      this.kept.push(kept.text);
      this.statements += 1;
      yield { type: CHAT_EVENT.STATEMENT, text: kept.text, chunkIds: kept.chunkIds };
    }
  }
}

/** Asks the model and sends each statement as soon as it is complete; the result is the follow-up questions. */
async function* streamStatements(
  prepared: PreparedAnswer,
  ports: ChatPorts,
  tally: AnswerTally,
  signal: AbortSignal | undefined
): AsyncGenerator<ChatEvent, string[]> {
  const parser = new StatementStream();
  const input: ChatInput = {
    system: chatSystemPrompt(prepared.config, prepared.history.length > 0),
    user: buildUserMessage(prepared.context, prepared.question, prepared.history),
    schema: ANSWER_JSON_SCHEMA,
    signal,
  };
  for await (const piece of ports.stream(input)) {
    yield* tally.events(parser.push(piece));
  }
  const rest = parser.finish();
  yield* tally.events(rest.statements);
  return rest.followUps;
}

/** The event that ends an answer the model could not finish: the quota is told apart from the rest. */
const errorEvent = (error: unknown): ChatEvent => ({
  type: CHAT_EVENT.ERROR,
  code:
    error instanceof GeminiError && error.status === HTTP_STATUS.TOO_MANY_REQUESTS
      ? API_ERROR.CHAT_LIMIT_REACHED
      : API_ERROR.INTERNAL,
});

/**
 * Streams the answer as events. A statement is checked against the context and sent as soon as the
 * model has finished it; one without a valid citation is left out. A failure ends the stream with
 * an ERROR event after the statements that already arrived. When `signal` aborts, the model request
 * ends and the stream stops without an event.
 */
export async function* answerQuestion(
  prepared: PreparedAnswer,
  ports: ChatPorts,
  signal?: AbortSignal
): AsyncGenerator<ChatEvent> {
  const tally = new AnswerTally(prepared.context, prepared.question, ports.onOmitted);
  let suggested: string[] = [];

  if (prepared.context.labels.length > 0) {
    try {
      suggested = yield* streamStatements(prepared, ports, tally, signal);
    } catch (error) {
      // The reader left: nobody is waiting for the end, and it is no failure of ours.
      if (signal?.aborted) return;
      ports.onError(error);
      yield errorEvent(error);
      return;
    }
  }

  // Questions only make sense next to an answer that has something to say.
  yield {
    type: CHAT_EVENT.DONE,
    statements: tally.statements,
    sourcesSearched: prepared.sourcesSearched,
    passagesFound: prepared.context.labels.length,
    droppedStatements: tally.droppedStatements,
    strippedCitations: tally.strippedCitations,
    followUps: tally.statements > 0 ? cleanFollowUps(suggested, prepared.question) : [],
  };
}
