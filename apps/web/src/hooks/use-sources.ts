import {
  SOURCE_STATUS,
  SourceListSchema,
  type SourceSummary,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, expectOk, readJson, toRequestError } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const POLL_INTERVAL_MS = 2000;

const isWorking = (source: SourceSummary) =>
  source.status === SOURCE_STATUS.PENDING || source.status === SOURCE_STATUS.PROCESSING;

/** The sources of a notebook. Reloads itself every two seconds while one is still being read. */
export function useSources(notebookId: string) {
  return useQuery({
    queryKey: queryKeys.sources(notebookId),
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].sources.$get({ param: { notebookId } }),
        SourceListSchema
      ),
    refetchInterval: (query) => (query.state.data?.some(isWorking) ? POLL_INTERVAL_MS : false),
  });
}

function useRefreshSources(notebookId: string) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.sources(notebookId) });
}

export function useUploadFile(notebookId: string) {
  const refresh = useRefreshSources(notebookId);
  return useMutation({
    mutationFn: async (file: File) => {
      // The upload route takes a multipart form, which the typed client does not describe.
      const form = new FormData();
      form.set('file', file);
      const response = await fetch(`/api/notebooks/${notebookId}/sources/file`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) throw await toRequestError(response);
      return SubmitSourceResultSchema.parse(await response.json());
    },
    onSuccess: refresh,
  });
}

export function useAddUrl(notebookId: string) {
  const refresh = useRefreshSources(notebookId);
  return useMutation({
    mutationFn: async (url: string) =>
      readJson(
        await api.api.notebooks[':notebookId'].sources.url.$post({
          param: { notebookId },
          json: { url },
        }),
        SubmitSourceResultSchema
      ),
    onSuccess: refresh,
  });
}

export function useToggleSource(notebookId: string) {
  const refresh = useRefreshSources(notebookId);
  return useMutation({
    mutationFn: async ({ sourceId, selected }: { sourceId: string; selected: boolean }) =>
      expectOk(
        await api.api.notebooks[':notebookId'].sources[':sourceId'].$patch({
          param: { notebookId, sourceId },
          json: { selected },
        })
      ),
    onSuccess: refresh,
  });
}

export function useRemoveSource(notebookId: string) {
  const refresh = useRefreshSources(notebookId);
  return useMutation({
    mutationFn: async (sourceId: string) =>
      expectOk(
        await api.api.notebooks[':notebookId'].sources[':sourceId'].$delete({
          param: { notebookId, sourceId },
        })
      ),
    onSuccess: refresh,
  });
}
