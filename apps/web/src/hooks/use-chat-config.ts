import { type ChatConfig, ChatConfigSchema } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function useChatConfig(notebookId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.chatConfig(notebookId),
    enabled,
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId']['chat-config'].$get({ param: { notebookId } }),
        ChatConfigSchema
      ),
  });
}

export function useSaveChatConfig(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (config: ChatConfig) =>
      readJson(
        await api.api.notebooks[':notebookId']['chat-config'].$put({
          param: { notebookId },
          json: config,
        }),
        ChatConfigSchema
      ),
    onSuccess: (saved) => client.setQueryData(queryKeys.chatConfig(notebookId), saved),
  });
}
