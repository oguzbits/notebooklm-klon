import { ChunkDetailSchema, SourceTextSchema } from '@nlm/shared';
import { useQuery } from '@tanstack/react-query';

import { api, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** A cited passage. Passages never change, so it is cached for a while. */
export function useChunk(notebookId: string, chunkId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.chunk(notebookId, chunkId),
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].chunks[':chunkId'].$get({
          param: { notebookId, chunkId },
        }),
        ChunkDetailSchema
      ),
    enabled,
    staleTime: FIVE_MINUTES_MS,
    retry: false,
  });
}

export function useSourceText(notebookId: string, sourceId: string | null) {
  return useQuery({
    queryKey: queryKeys.sourceText(notebookId, sourceId ?? ''),
    queryFn: async () => {
      if (sourceId === null) throw new Error('No source to load.');
      return readJson(
        await api.api.notebooks[':notebookId'].sources[':sourceId'].text.$get({
          param: { notebookId, sourceId },
        }),
        SourceTextSchema
      );
    },
    enabled: sourceId !== null,
    staleTime: FIVE_MINUTES_MS,
    retry: false,
  });
}
