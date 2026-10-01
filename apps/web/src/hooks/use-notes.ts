import { type Note, NOTE_KIND, NoteListSchema, NoteSchema, type NoteUpdateBody } from '@nlm/shared';
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
          json: { kind: NOTE_KIND.ANSWER, messageId },
        }),
        NoteSchema
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notes(notebookId) }),
  });
}

/**
 * Makes an empty note to write in. It is the newest, so it goes to the top of the list at once and
 * the view that opens on it finds it there without waiting for the list to load again.
 */
export function useCreateWrittenNote(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].notes.$post({
          param: { notebookId },
          json: { kind: NOTE_KIND.WRITTEN },
        }),
        NoteSchema
      ),
    onSuccess: (created) =>
      client.setQueryData<Note[]>(queryKeys.notes(notebookId), (list) => [
        created,
        ...(list ?? []),
      ]),
  });
}

/**
 * Changes the title or, for a note of the reader, the text. The answer replaces the note in the
 * list, so the title changes without waiting for a second request.
 */
export function useUpdateNote(notebookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, changes }: { noteId: string; changes: NoteUpdateBody }) =>
      readJson(
        await api.api.notebooks[':notebookId'].notes[':noteId'].$patch({
          param: { notebookId, noteId },
          json: changes,
        }),
        NoteSchema
      ),
    onSuccess: (updated) =>
      client.setQueryData<Note[]>(queryKeys.notes(notebookId), (list) =>
        list?.map((note) => (note.id === updated.id ? updated : note))
      ),
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
