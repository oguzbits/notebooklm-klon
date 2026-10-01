import { NotebookListSchema, NotebookSchema, type UpdateNotebookBody } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, expectOk, readJson, toRequestError } from '@/lib/api';
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

/** Makes a copy of the notebook with the same sources; the answer is the new notebook. */
export function useCopyNotebook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (notebookId: string) =>
      readJson(
        await api.api.notebooks[':notebookId'].copy.$post({ param: { notebookId } }),
        NotebookSchema
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notebooks, exact: true }),
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

/** The address of the cover image; the version changes with every new image, so the browser fetches it again. */
export const coverUrl = (notebookId: string, version: string) =>
  `/api/notebooks/${notebookId}/cover?v=${version}`;

/** Sets the cover image of a notebook to a file the reader chose. */
export function useUploadCover(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      // The upload is a multipart form, which the typed client does not describe.
      const form = new FormData();
      form.set('file', file);
      const response = await fetch(`/api/notebooks/${notebookId}/cover`, {
        method: 'PUT',
        body: form,
      });
      if (!response.ok) throw await toRequestError(response);
      return NotebookSchema.parse(await response.json());
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notebooks, exact: true }),
  });
}

export function useRemoveCover(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      expectOk(await api.api.notebooks[':notebookId'].cover.$delete({ param: { notebookId } })),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notebooks, exact: true }),
  });
}
