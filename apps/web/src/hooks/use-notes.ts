import { NoteListSchema, NoteSchema } from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, expectOk, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export function useNotes(notebookId: string) {
  return useQuery({
    queryKey: queryKeys.notes(notebookId),
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].notes.$get({ param: { notebookId } }),
        NoteListSchema
      ),
  });
}

/** Saves a saved answer as a note. The server copies the content, only the ID is sent. */
export function useCreateNote(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) =>
      readJson(
        await api.api.notebooks[':notebookId'].notes.$post({
          param: { notebookId },
          json: { messageId },
        }),
        NoteSchema
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notes(notebookId) }),
  });
}

export function useDeleteNote(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) =>
      expectOk(
        await api.api.notebooks[':notebookId'].notes[':noteId'].$delete({
          param: { notebookId, noteId },
        })
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notes(notebookId) }),
  });
}
