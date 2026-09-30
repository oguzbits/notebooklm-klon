import { type AnswerStatement, API_ERROR, CHAT_EVENT, ChatMessageListSchema } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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
  statements: AnswerStatement[];
}

/**
 * Asks a question and collects the streamed statements. When the stream ends the history is loaded
 * again: the server saved the turn, so the live answer is replaced by the saved one.
 */
export function useAskQuestion(notebookId: string) {
  const client = useQueryClient();
  const [live, setLive] = useState<LiveAnswer | null>(null);

  const mutation = useMutation({
    mutationFn: async (question: string) => {
      setLive({ question, statements: [] });
      for await (const event of streamChat(notebookId, question)) {
        if (event.type === CHAT_EVENT.STATEMENT) {
          const statement = { text: event.text, chunkIds: event.chunkIds };
          setLive((current) =>
            current ? { ...current, statements: [...current.statements, statement] } : current
          );
        } else if (event.type === CHAT_EVENT.ERROR) {
          throw new ApiRequestError(event.code, 200);
        }
      }
    },
    onSettled: async (_data, error) => {
      // A rejected question (409, 429) was not saved: nothing to load, the error stays visible.
      const saved = !(error instanceof ApiRequestError) || error.status === 200;
      if (saved) await client.invalidateQueries({ queryKey: queryKeys.messages(notebookId) });
      setLive(null);
    },
  });

  return { ...mutation, live };
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
