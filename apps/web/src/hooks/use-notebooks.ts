import { NotebookListSchema, NotebookSchema, type UpdateNotebookBody } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, expectOk, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function useNotebooks() {
  return useQuery({
    queryKey: queryKeys.notebooks,
    queryFn: async () => readJson(await api.api.notebooks.$get(), NotebookListSchema),
  });
}

export function useNotebook(notebookId: string) {
  const list = useNotebooks();
  return { ...list, data: list.data?.find((notebook) => notebook.id === notebookId) };
}

export function useCreateNotebook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) =>
      readJson(await api.api.notebooks.$post({ json: { title } }), NotebookSchema),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notebooks }),
  });
}

export function useDeleteNotebook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (notebookId: string) =>
      expectOk(await api.api.notebooks[':notebookId'].$delete({ param: { notebookId } })),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notebooks }),
  });
}

/** Changes the title and/or the own summary of the notebook. The summary on the page follows. */
export function useUpdateNotebook(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (changes: UpdateNotebookBody) =>
      readJson(
        await api.api.notebooks[':notebookId'].$patch({ param: { notebookId }, json: changes }),
        NotebookSchema
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.notebooks, exact: true });
      // Whatever sources it was made from, the summary on the page may have changed.
      await client.invalidateQueries({ queryKey: ['notebooks', notebookId, 'overview'] });
    },
  });
}
