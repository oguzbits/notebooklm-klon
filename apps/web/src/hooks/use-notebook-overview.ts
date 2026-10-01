import { NotebookOverviewResponseSchema, SOURCE_STATUS, type SourceSummary } from '@nlm/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

/**
 * What all ready sources of the notebook are about, with the symbol the notebook wears. The server
 * makes it when the set of ready sources changed and keeps it, so asking is cheap, but making it
 * costs a model call: it is asked for only once every source is read (one upload, one overview), and
 * the summary that was there stays on screen until the new one arrives.
 */
export function useNotebookOverview(notebookId: string, sources: SourceSummary[] | undefined) {
  const client = useQueryClient();
  const ready = (sources ?? [])
    .filter((source) => source.status === SOURCE_STATUS.READY)
    .map((source) => source.id)
    .sort();
  // A source that is waiting or being read will change the set, so it is not asked for yet.
  const settled = (sources ?? []).every(
    (source) => source.status === SOURCE_STATUS.READY || source.status === SOURCE_STATUS.FAILED
  );

  const query = useQuery({
    queryKey: queryKeys.notebookOverview(notebookId, ready.join(',')),
    queryFn: async () =>
      readJson(
        await api.api.notebooks[':notebookId'].overview.$get({ param: { notebookId } }),
        NotebookOverviewResponseSchema
      ),
    enabled: ready.length > 0 && settled,
    // The server stores it for exactly this set of sources.
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const emoji = query.data?.overview?.emoji;
  // The cards of the start page and the title row show the symbol of the notebook.
  useEffect(() => {
    // Exactly the list: a prefix would also take the overview itself and ask for it a second time.
    if (emoji) void client.invalidateQueries({ queryKey: queryKeys.notebooks, exact: true });
  }, [emoji, client]);

  return {
    overview: query.data?.overview ?? null,
    ready: ready.length > 0,
    loading: query.isPending && ready.length > 0,
    error: query.error,
    isError: query.isError,
    retry: () => query.refetch(),
    retrying: query.isFetching,
  };
}
