import { type CreateStudioBody, StudioOutputListSchema, StudioOutputSchema } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, expectOk, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function useStudioOutputs(notebookId: string) {
  return useQuery({
    queryKey: queryKeys.studio(notebookId),
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].studio.$get({ param: { notebookId } }),
        StudioOutputListSchema
      ),
  });
}

/** Makes an output from the selected sources. Takes a few seconds, so callers show it as pending. */
export function useCreateStudioOutput(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateStudioBody) =>
      readJson(
        await api.api.notebooks[':notebookId'].studio.$post({
          param: { notebookId },
          json: body,
        }),
        StudioOutputSchema
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.studio(notebookId) }),
  });
}

export function useDeleteStudioOutput(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (outputId: string) =>
      expectOk(
        await api.api.notebooks[':notebookId'].studio[':outputId'].$delete({
          param: { notebookId, outputId },
        })
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.studio(notebookId) }),
  });
}
