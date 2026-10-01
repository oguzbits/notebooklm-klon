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
import { ANSWER_JSON_SCHEMA, buildUserMessage, chatSystemPrompt } from '../core/chat-prompt';
import { cleanFollowUps } from '../core/follow-ups';
import { StatementStream } from '../core/statement-stream';

const QUOTA_STATUS = 429;

/** The user has no ready, selected source in this notebook, so there is nothing to answer from. */
export class NoSourcesSelectedError extends Error {
  constructor() {
    super('No source is selected.');
    this.name = 'NoSourcesSelectedError';
  }
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
}

export interface PreparedAnswer {
  question: string;
  /** How many sources the question was searched in (the selected, ready ones). */
  sourcesSearched: number;
  context: ChatContext;
  config: ChatConfig;
}

/**
 * Everything that can fail before an answer starts: which sources, the question's vector, the
 * search. Kept apart from streaming so the route can still answer with an HTTP status.
 */
export async function prepareAnswer(
  input: { userId: string; notebookId: string; question: string; config?: ChatConfig },
  ports: ChatPorts
): Promise<PreparedAnswer> {
  const sourceIds = await ports.selectedSourceIds(input.userId, input.notebookId);
  if (sourceIds.length === 0) throw new NoSourcesSelectedError();

  const queryEmbedding = await ports.embedQuery(input.question);
  const chunks = await ports.search({
    userId: input.userId,
    notebookId: input.notebookId,
    sourceIds,
    queryEmbedding,
    queryText: input.question,
    limit: LIMITS.CHAT_CONTEXT_CHUNKS,
  });
  return {
    question: input.question,
    sourcesSearched: sourceIds.length,
    context: buildChatContext(chunks),
    config: input.config ?? DEFAULT_CHAT_CONFIG,
  };
}

/**
 * Streams the answer as events. A statement is checked against the context and sent as soon as the
 * model has finished it; one without a valid citation is left out. A failure ends the stream with
 * an ERROR event after the statements that already arrived.
 */
export async function* answerQuestion(
  prepared: PreparedAnswer,
  ports: ChatPorts
): AsyncGenerator<ChatEvent> {
  const { context, question, config } = prepared;
  let statements = 0;
  let droppedStatements = 0;
  let strippedCitations = 0;
  let suggested: string[] = [];

  const check = (statement: { text: string; chunkIds: string[] }): ChatEvent | null => {
    const result = resolveCitations({ statements: [statement] }, context);
    strippedCitations += result.strippedCitations;
    const [kept] = result.answer.statements;
    if (!kept) {
      droppedStatements += 1;
      return null;
    }
    statements += 1;
    return { type: CHAT_EVENT.STATEMENT, text: kept.text, chunkIds: kept.chunkIds };
  };

  if (context.labels.length > 0) {
    try {
      const parser = new StatementStream();
      const input: ChatInput = {
        system: chatSystemPrompt(config),
        user: buildUserMessage(context, question),
        schema: ANSWER_JSON_SCHEMA,
      };
      for await (const piece of ports.stream(input)) {
        for (const statement of parser.push(piece)) {
          const event = check(statement);
          if (event) yield event;
        }
      }
      const rest = parser.finish();
      for (const statement of rest.statements) {
        const event = check(statement);
        if (event) yield event;
      }
      suggested = rest.followUps;
    } catch (error) {
      ports.onError(error);
      const isQuota = error instanceof GeminiError && error.status === QUOTA_STATUS;
      yield {
        type: CHAT_EVENT.ERROR,
        code: isQuota ? API_ERROR.CHAT_LIMIT_REACHED : API_ERROR.INTERNAL,
      };
      return;
    }
  }

  // Questions only make sense next to an answer that has something to say.
  const followUps = statements > 0 ? cleanFollowUps(suggested, question) : [];
  yield {
    type: CHAT_EVENT.DONE,
    statements,
    sourcesSearched: prepared.sourcesSearched,
    passagesFound: context.labels.length,
    droppedStatements,
    strippedCitations,
    followUps,
  };
}
