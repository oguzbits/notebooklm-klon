import { type AnswerStatement, API_ERROR, CHAT_EVENT, ChatMessageListSchema } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { api, ApiRequestError, expectOk, readJson } from '@/lib/api';
import { streamChat } from '@/lib/chat-stream';
import { queryKeys } from '@/lib/query-keys';

export function useChatHistory(notebookId: string) {
  return useQuery({
    queryKey: queryKeys.messages(notebookId),
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].messages.$get({ param: { notebookId } }),
        ChatMessageListSchema
      ),
  });
}

/** The answer that is being written right now, before the server has saved it. */
export interface LiveAnswer {
  question: string;
  /** When the question was sent, for the time above it. */
  askedAt: string;
  statements: AnswerStatement[];
}

/** The server saves a cut answer a moment after the connection closed, so the history is read again then. */
const SAVE_AFTER_STOP_MS = 1000;

/**
 * Asks a question and collects the streamed statements. When the stream ends the history is loaded
 * again: the server saved the turn, so the live answer is replaced by the saved one.
 * `stop` ends the answer early (the server keeps what was written); leaving the notebook does the same.
 */
export function useAskQuestion(notebookId: string) {
  const client = useQueryClient();
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const running = useRef<AbortController | null>(null);
  const stopped = useRef(false);
  const reload = () => client.invalidateQueries({ queryKey: queryKeys.messages(notebookId) });

  useEffect(() => () => running.current?.abort(), [notebookId]);

  const mutation = useMutation({
    mutationFn: async (question: string) => {
      const abort = new AbortController();
      running.current = abort;
      stopped.current = false;
      setLive({ question, askedAt: new Date().toISOString(), statements: [] });
      try {
        for await (const event of streamChat(notebookId, question, abort.signal)) {
          if (event.type === CHAT_EVENT.STATEMENT) {
            const statement = { text: event.text, chunkIds: event.chunkIds };
            setLive((current) =>
              current ? { ...current, statements: [...current.statements, statement] } : current
            );
          } else if (event.type === CHAT_EVENT.ERROR) {
            throw new ApiRequestError(event.code, 200);
          }
        }
      } catch (error) {
        // The reader asked for the stop: that is no failure, the answer is just shorter.
        if (!abort.signal.aborted) throw error;
        stopped.current = true;
      }
    },
    onSettled: async (_data, error) => {
      // A rejected question (409, 429) was not saved: nothing to load, the error stays visible.
      const saved = !(error instanceof ApiRequestError) || error.status === 200;
      if (saved) await reload();
      if (saved && stopped.current) setTimeout(() => void reload(), SAVE_AFTER_STOP_MS);
      setLive(null);
    },
  });

  return { ...mutation, live, stop: () => running.current?.abort() };
}

export { API_ERROR };

/** Deletes the whole chat history of the notebook. */
export function useClearChat(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      expectOk(await api.api.notebooks[':notebookId'].messages.$delete({ param: { notebookId } })),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.messages(notebookId) }),
  });
}
