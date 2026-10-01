import {
  type CreateStudioBody,
  type StudioOutput,
  StudioOutputListSchema,
  StudioOutputSchema,
  type StudioUpdateBody,
} from '@nlm/shared';
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

/**
 * Renames an output, rates it or marks it read. The answer replaces the output in the list at once,
 * so the title or the dot changes without waiting for a second request.
 */
export function useUpdateStudioOutput(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ outputId, changes }: { outputId: string; changes: StudioUpdateBody }) =>
      readJson(
        await api.api.notebooks[':notebookId'].studio[':outputId'].$patch({
          param: { notebookId, outputId },
          json: changes,
        }),
        StudioOutputSchema
      ),
    onSuccess: (updated) =>
      client.setQueryData<StudioOutput[]>(queryKeys.studio(notebookId), (list) =>
        list?.map((output) => (output.id === updated.id ? updated : output))
      ),
  });
}
